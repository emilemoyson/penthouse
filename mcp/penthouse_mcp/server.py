"""Penthouse MCP server.

Reads go through a read-only Postgres role (db.py). The one write, import_receipts, goes through
POST /api/ingest/groceries with the bearer token, like every other script that feeds the dashboard.

Advanced MCP features, each for a reason:
- Sampling (what_can_i_cook, weekly_summary): the numbers are computed here, the client's own model
  writes the prose. The server needs no API key. Clients without sampling get the numbers and a note.
- Roots (import_receipts): the server only reads receipt files inside folders the client shared.
- Progress and log notifications (import_receipts): one step and one message per receipt.

Sampling and roots go through Resolve(...) resolvers, so they work on both the 2025-11-25 protocol
(server-to-client requests) and 2026-07-28 (input-required round trips). Both are deprecated in
2026-07-28 (SEP-2577); see mcp/README.md, Known limits.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import unquote, urlparse

import httpx
from mcp import types
from mcp.server.mcpserver import Context, ListRoots, MCPServer, Resolve, Sample
from mcp.server.mcpserver.exceptions import ToolError

from . import config, db
from .kitchen import USE_SOON_DAYS, add_days, fmt_qty, today_iso
from .receipts import SUFFIXES, build_payload

logging.getLogger("httpx").setLevel(logging.WARNING)  # one line per request on stderr is noise in a client

app = MCPServer(
    "penthouse",
    instructions=(
        "Emile's kitchen and gym data from the Penthouse dashboard (New York, US dollars). "
        "Pantry amounts are in g, ml, item or serving. Dates are YYYY-MM-DD. "
        "Write plainly, no em dashes, and use they/them for Emile."
    ),
)

STYLE = "Plain, understated English. No em dashes. Use they/them for Emile. Never invent numbers that are not in the data."


def _check_date(s: str, name: str) -> str:
    try:
        add_days(s, 0)
    except ValueError:
        raise ToolError(f"{name} must be a date like 2026-11-04, got {s!r}.")
    return s


async def _guard(coro):
    try:
        return await coro
    except db.NotConfigured as e:
        raise ToolError(str(e))


def _text(result: Any) -> str | None:
    """Text of a sampling result, or None when the client couldn't sample."""
    if result is None:
        return None
    content = result.content if not isinstance(result.content, list) else result.content[0]
    return getattr(content, "text", None)


def _can_sample(ctx: Context) -> bool:
    caps = ctx.client_capabilities
    return bool(caps and caps.sampling)


NO_SAMPLING = "This client doesn't support MCP sampling, so the server returned the numbers only. Write the text from them."


# ---------- plain reads ----------

@app.tool()
async def get_pantry(place: str | None = None) -> dict:
    """What's in the fridge, freezer and pantry right now: amount left, price, macros, use-by and days left.
    place: 'fridge', 'freezer' or 'pantry' to filter. size_guessed=true means the package size was estimated."""
    if place and place not in ("fridge", "freezer", "pantry"):
        raise ToolError("place must be fridge, freezer or pantry.")
    items = await _guard(db.pantry(place))
    return {"today": today_iso(), "count": len(items), "items": items}


@app.tool()
async def get_meals(date_from: str, date_to: str) -> dict:
    """Meals logged between two dates (inclusive): kcal, protein, carbs, fat, cost in dollars, home or out.
    Days synced from MyFitnessPal replace hand-logged meals that day, as on the dashboard."""
    _check_date(date_from, "date_from")
    _check_date(date_to, "date_to")
    rows = await _guard(db.meals(date_from, date_to))
    return {"from": date_from, "to": date_to, "count": len(rows), "meals": rows}


@app.tool()
async def get_spend(date_from: str, date_to: str) -> dict:
    """Food spending between two dates (inclusive): groceries (receipt totals) and eating out (meal costs),
    per day and in total, average cost per meal at home vs out, and protein per dollar over costed meals."""
    _check_date(date_from, "date_from")
    _check_date(date_to, "date_to")
    return await _guard(db.spend(date_from, date_to))


@app.tool()
async def get_workouts(date_from: str, date_to: str) -> dict:
    """Gym sessions between two dates (inclusive) with their sets, plus the best estimated one-rep max
    (Epley) per exercise in that range. date_estimated=true means the session's date was inferred."""
    _check_date(date_from, "date_from")
    _check_date(date_to, "date_to")
    return await _guard(db.workouts(date_from, date_to))


# ---------- what can I cook (sampling) ----------

async def _cook_data(servings: int = 2) -> dict:
    items = await _guard(db.pantry())
    items.sort(key=lambda i: (i["days_left"], i["name"]))
    slim = [
        {"name": i["name"], "left": fmt_qty(i["qty"], i["unit"]), "place": i["place"], "days_left": i["days_left"],
         "cost_left": i["value_left"], "protein_per": i["protein_per"], "per": "100 g" if i["unit"] in ("g", "ml") else i["unit"]}
        for i in items
    ]
    return {"servings": servings, "use_soon": [i for i in slim if i["days_left"] <= USE_SOON_DAYS], "pantry": slim}


def _cook_sample(data: Annotated[dict, Resolve(_cook_data)], ctx: Context, notes: str = "") -> Sample | None:
    if not _can_sample(ctx) or not data["pantry"]:
        return None
    prompt = (
        f"Pantry (JSON, sorted by days left, negative = past its date):\n{json.dumps(data['pantry'])}\n\n"
        f"Suggest 3 dishes for {data['servings']} serving(s). Use only these items plus oil, salt, pepper and dried spices. "
        f"Start with items that have {USE_SOON_DAYS} or fewer days left. For each dish: a name, the items with rough amounts, "
        "and a rough cost from cost_left. Keep it under 180 words."
        + (f"\nRequest from Emile: {notes}" if notes else "")
    )
    return Sample(
        [types.SamplingMessage(role="user", content=types.TextContent(text=prompt))],
        max_tokens=600,
        system_prompt=f"You suggest home-cooked meals from a real pantry. {STYLE}",
    )


@app.tool()
async def what_can_i_cook(
    data: Annotated[dict, Resolve(_cook_data)],
    ideas: Annotated[Any, Resolve(_cook_sample)],
    ctx: Context,
    servings: int = 2,
    notes: str = "",
) -> dict:
    """Three dish ideas from what is in the pantry, using up items that expire soon first.
    servings: how many portions. notes: anything to take into account, e.g. 'no oven' or 'high protein'.
    The ideas are written by the client's model through MCP sampling; the item list comes from the database."""
    text = _text(ideas)
    if not data["pantry"]:
        return {**data, "ideas": None, "note": "The pantry is empty."}
    return {**data, "ideas": text, "note": None if text else NO_SAMPLING}


# ---------- weekly summary (sampling) ----------

async def _week_data(week_start: str = "", weekly_budget: float | None = None) -> dict:
    start = _check_date(week_start, "week_start") if week_start else add_days(today_iso(), -6)
    end = add_days(start, 6)
    spend = await _guard(db.spend(start, end))
    meals = await _guard(db.meals(start, end))
    waste = await _guard(db.waste(start, end))
    workouts = await _guard(db.workouts(start, end))
    budget = weekly_budget
    if budget is None:
        stored = await _guard(db.kv("food_budget"))
        budget = stored.get("weekly") if isinstance(stored, dict) else None
    return {
        "from": start,
        "to": end,
        "spend": spend,
        "budget": {"weekly": budget, "left": round(budget - spend["total"], 2) if budget is not None else None},
        "meals": {"count": len(meals), "home": sum(1 for m in meals if m["kind"] == "home"),
                  "out": sum(1 for m in meals if m["kind"] == "out"),
                  "kcal": round(sum(m["kcal"] for m in meals)), "protein_g": round(sum(m["protein"] for m in meals))},
        "waste": {"items": waste, "value_lost": round(sum(w["value_lost"] or 0 for w in waste), 2)},
        "gym_sessions": len(workouts["sessions"]),
    }


def _week_sample(data: Annotated[dict, Resolve(_week_data)], ctx: Context) -> Sample | None:
    if not _can_sample(ctx):
        return None
    prompt = (
        f"One week of Emile's food and gym data (JSON):\n{json.dumps(data)}\n\n"
        "Write a short weekly summary, under 150 words: spend vs budget (say so if there is no budget), "
        "protein per dollar, cost per meal at home vs out, anything that went past its date (waste), "
        "and exactly one concrete recommendation for next week. Say plainly where data is missing."
    )
    return Sample(
        [types.SamplingMessage(role="user", content=types.TextContent(text=prompt))],
        max_tokens=500,
        system_prompt=f"You write short, honest weekly reviews of personal food data. {STYLE}",
    )


@app.tool()
async def weekly_summary(
    data: Annotated[dict, Resolve(_week_data)],
    summary: Annotated[Any, Resolve(_week_sample)],
    week_start: str = "",
    weekly_budget: float | None = None,
) -> dict:
    """A week of kitchen data in one call: spend vs budget, protein per dollar, cost per meal home vs out,
    waste (items past their date with something left) and gym sessions, plus a short summary written by the
    client's model through MCP sampling. week_start: YYYY-MM-DD (default: the 7 days ending today).
    weekly_budget: dollars; default is the stored food_budget, if any."""
    text = _text(summary)
    return {**data, "summary": text, "note": None if text else NO_SAMPLING}


# ---------- import receipts (roots, progress, logging, write via /api/ingest) ----------

def _roots(ctx: Context) -> ListRoots | None:
    caps = ctx.client_capabilities
    return ListRoots() if caps and caps.roots else None


def _root_paths(result: Any) -> list[Path]:
    paths = []
    for r in result.roots if result else []:
        u = urlparse(str(r.uri))
        if u.scheme == "file":
            paths.append(Path(unquote(u.path)).resolve())
    return paths


@app.tool()
async def import_receipts(
    folder: str,
    roots: Annotated[Any, Resolve(_roots)],
    ctx: Context,
    dry_run: bool = True,
) -> dict:
    """Import Lidl printed receipts (.txt or .html) from a folder into the pantry.
    Each file is cut before the payment block on this machine, its food lines are read here, and only those
    are sent to the dashboard's /api/ingest/groceries. Re-importing the same receipt is skipped.
    The folder must be inside one of the client's roots. dry_run=true (default) shows what would be sent."""
    allowed = _root_paths(roots)
    if not allowed:
        raise ToolError("This client shared no roots, so the server won't read any files. "
                        "Use a client with MCP roots support (Claude Code shares the project folder).")
    target = Path(folder).expanduser()
    if not target.is_absolute() and len(allowed) == 1:
        target = allowed[0] / target
    target = target.resolve()
    if not any(target == a or target.is_relative_to(a) for a in allowed):
        raise ToolError(f"{target} is outside the client's roots ({', '.join(map(str, allowed))}).")
    if not target.is_dir():
        raise ToolError(f"{target} is not a folder.")

    files = sorted(p for p in target.iterdir() if p.suffix.lower() in SUFFIXES and p.is_file())
    if not files:
        return {"folder": str(target), "files": 0, "results": [], "note": "No .txt or .html receipts in this folder."}

    s = config.load()
    if not dry_run and not (s.ingest_url and s.ingest_token):
        raise ToolError("INGEST_URL and INGEST_TOKEN are not set (mcp/.env or scripts/.env).")

    await ctx.info(f"{len(files)} receipt file(s) in {target.name}{' (dry run)' if dry_run else ''}")
    results = []
    async with httpx.AsyncClient(timeout=180) as http:
        for n, path in enumerate(files, 1):
            await ctx.report_progress(n - 1, len(files), f"Reading {path.name}")
            payload = build_payload(path)
            row: dict[str, Any] = {"file": path.name, "date": payload["date"], "store": payload["store"],
                                   "items": len(payload.get("items", [])), "ext_id": payload["extId"]}
            if "items" not in payload and "text" not in payload:
                row["status"] = "skipped: empty after the payment cut"
                await ctx.warning(f"{path.name}: nothing before the payment block, skipped")
            elif dry_run:
                row["status"] = "dry run"
                row["preview"] = payload.get("items", [])[:50] or "unrecognised layout: the cut text would be sent for Claude to read"
                await ctx.info(f"{path.name}: {row['items']} food line(s) found")
            else:
                try:
                    res = await http.post(
                        s.ingest_url.rstrip("/") + "/api/ingest/groceries",
                        json=payload,
                        headers={"Authorization": f"Bearer {s.ingest_token}"},
                    )
                    body = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
                    if res.status_code == 200:
                        row["status"] = "already saved" if body.get("skipped") else "saved"
                        row["message"] = body.get("message")
                        await ctx.info(f"{path.name}: {body.get('message', 'saved')}")
                    else:
                        row["status"] = f"error {res.status_code}"
                        row["message"] = body.get("error") or body.get("message")
                        await ctx.warning(f"{path.name}: {row['status']} {row['message'] or ''}".strip())
                except httpx.HTTPError as e:
                    row["status"] = "error"
                    row["message"] = type(e).__name__
                    await ctx.warning(f"{path.name}: could not reach the dashboard ({type(e).__name__})")
            results.append(row)
            await ctx.report_progress(n, len(files), f"Done {path.name}")
    out = {"folder": str(target), "files": len(files), "dry_run": dry_run, "results": results}
    if dry_run:
        out["note"] = ("Preview shows receipt lines as printed. On a real import the dashboard converts lb, oz and kg to g, "
                       "and Claude fills in package sizes and macros (sizes it had to guess are flagged 'check size').")
    return out


# ---------- resources and prompt ----------

@app.resource("penthouse://pantry", name="pantry", mime_type="application/json",
              description="Open pantry items (fridge, freezer, pantry) with days left.")
async def pantry_resource() -> str:
    return json.dumps(await _guard(db.pantry()), default=str)


@app.resource("penthouse://meals/{date}", name="meals-on-date", mime_type="application/json",
              description="Meals logged on one day (YYYY-MM-DD).")
async def meals_resource(date: str) -> str:
    _check_date(date, "date")
    return json.dumps(await _guard(db.meals(date, date)), default=str)


@app.prompt(name="weekly-review", description="Review a week of food and gym data with one recommendation.")
def weekly_review(week_start: str = "") -> str:
    week = f"the week starting {week_start}" if week_start else "the last 7 days"
    return (
        f"Review {week} for Emile. Call the penthouse tool weekly_summary"
        + (f" with week_start={week_start}" if week_start else "")
        + ", then get_workouts for the same dates. Write a short review in plain English (no em dashes, they/them): "
        "spend vs budget, protein per dollar, cost per meal at home vs out, waste, gym sessions and best lifts, "
        "and end with exactly one concrete recommendation. Quote only numbers the tools returned and say where data is missing."
    )
