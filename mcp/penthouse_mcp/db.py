"""Read-only queries. Connects as penthouse_ro (see sql/readonly_role.sql) and also marks
every session read-only, so a write fails even if the role is ever granted too much."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import psycopg
from psycopg.rows import dict_row

from . import config
from .kitchen import days_left, e1rm, expiry_of, item_cost, today_iso


class NotConfigured(RuntimeError):
    pass


@asynccontextmanager
async def connect() -> AsyncIterator[psycopg.AsyncConnection]:
    url = config.load().db_url
    if not url:
        raise NotConfigured("PENTHOUSE_RO_DATABASE_URL is not set (see mcp/README.md).")
    conn = await psycopg.AsyncConnection.connect(url, autocommit=True, row_factory=dict_row, connect_timeout=10)
    try:
        await conn.execute("set session characteristics as transaction read only")
        yield conn
    finally:
        await conn.close()


async def _all(sql: str, params: tuple = ()) -> list[dict[str, Any]]:
    async with connect() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchall()


def _r2(v: float | None) -> float | None:
    return None if v is None else round(v, 2)


# ---------- pantry ----------

async def pantry(place: str | None = None, today: str | None = None) -> list[dict]:
    today = today or today_iso()
    rows = await _all(
        """select id, name, place, qty, qty_start, unit, price, kcal_per, protein_per, carbs_per, fat_per,
                  bought, use_by, size_guessed
           from pantry_items where finished_at is null and qty > 0 order by name"""
    )
    out = []
    for r in rows:
        if place and r["place"] != place:
            continue
        r["days_left"] = days_left(r, today)
        r["expires"] = expiry_of(r)
        r["value_left"] = _r2(item_cost(r, r["qty"]))
        out.append(r)
    return out


# ---------- meals and spending ----------

async def meals(date_from: str, date_to: str) -> list[dict]:
    rows = await _all(
        """select id, date, time, name, kcal, protein, carbs, fat, cost, kind, source
           from meals where date >= %s and date <= %s order by date, time, id""",
        (date_from, date_to),
    )
    # a day synced from MyFitnessPal is complete on its own: skip hand-logged rows that day (as getNutritionData does)
    mfp_days = {r["date"] for r in rows if r["source"] == "mfp"}
    out = []
    for r in rows:
        if r["date"] in mfp_days and r["source"] != "mfp":
            continue
        r["kind"] = "out" if r["kind"] == "out" else "home"
        r["cost"] = _r2(r["cost"])
        out.append(r)
    return out


async def grocery_runs(date_from: str, date_to: str) -> list[dict]:
    return await _all(
        "select id, date, store, total, source from grocery_runs where date >= %s and date <= %s order by date, id",
        (date_from, date_to),
    )


async def spend(date_from: str, date_to: str) -> dict:
    ms = await meals(date_from, date_to)
    runs = await grocery_runs(date_from, date_to)
    days: dict[str, dict] = {}
    for r in runs:
        days.setdefault(r["date"], {"groceries": 0.0, "out": 0.0})["groceries"] += r["total"]
    for m in ms:
        if m["kind"] == "out" and m["cost"]:
            days.setdefault(m["date"], {"groceries": 0.0, "out": 0.0})["out"] += m["cost"]
    groceries = sum(d["groceries"] for d in days.values())
    out = sum(d["out"] for d in days.values())

    def per_meal(kind: str) -> dict:
        costed = [m for m in ms if m["kind"] == kind and (m["cost"] or 0) > 0]
        total = sum(m["cost"] for m in costed)
        return {"meals_with_cost": len(costed), "meals_without_cost": sum(1 for m in ms if m["kind"] == kind) - len(costed),
                "avg_cost": _r2(total / len(costed)) if costed else None}

    costed = [m for m in ms if (m["cost"] or 0) > 0]
    cost_sum = sum(m["cost"] for m in costed)
    return {
        "from": date_from,
        "to": date_to,
        "groceries": _r2(groceries),
        "eating_out": _r2(out),
        "total": _r2(groceries + out),
        "by_day": [{"date": d, "groceries": _r2(v["groceries"]), "out": _r2(v["out"])} for d, v in sorted(days.items())],
        "grocery_runs": len(runs),
        "cost_per_meal": {"home": per_meal("home"), "out": per_meal("out")},
        # protein per dollar over meals that have a cost (same rule as the kitchen panel)
        "protein_per_dollar": _r2(sum(m["protein"] for m in costed) / cost_sum) if cost_sum else None,
    }


async def waste(date_from: str, date_to: str, today: str | None = None) -> list[dict]:
    """Items whose use-by (or default shelf life) fell in the range, before today, and still have something left.
    The amount is what is left now; the database doesn't keep what was left on the use-by day."""
    today = today or today_iso()
    rows = await _all(
        """select id, name, place, qty, qty_start, unit, price, bought, use_by, finished_at
           from pantry_items where qty > 0 and bought <= %s""",
        (date_to,),
    )
    out = []
    for r in rows:
        exp = expiry_of(r)
        if date_from <= exp <= date_to and exp < today:
            out.append({"name": r["name"], "expired": exp, "qty_left": r["qty"], "unit": r["unit"],
                        "value_lost": _r2(item_cost(r, r["qty"])), "place": r["place"]})
    return sorted(out, key=lambda x: x["expired"])


async def kv(key: str) -> Any:
    rows = await _all("select value from kv where key = %s", (key,))
    return rows[0]["value"] if rows else None


# ---------- gym ----------

async def workouts(date_from: str, date_to: str) -> dict:
    ws = await _all(
        """select id, date, kind, notes, date_estimated, duration_min from workouts
           where date >= %s and date <= %s order by date, id""",
        (date_from, date_to),
    )
    if not ws:
        return {"from": date_from, "to": date_to, "sessions": [], "best_e1rm": {}}
    sets = await _all(
        """select workout_id, exercise, ex_order, set_no, weight, unit, reps, reps_alt from sets
           where workout_id = any(%s) order by workout_id, ex_order, set_no""",
        ([w["id"] for w in ws],),
    )
    by_w: dict[int, list[dict]] = {}
    best: dict[str, dict] = {}
    for s in sets:
        by_w.setdefault(s["workout_id"], []).append(s)
        est = e1rm(s["weight"], s["reps"])
        cur = best.get(s["exercise"])
        if est > 0 and (cur is None or est > cur["e1rm"]):
            best[s["exercise"]] = {"e1rm": round(est, 1), "unit": s["unit"], "weight": s["weight"], "reps": s["reps"]}
    sessions = []
    for w in ws:
        exercises: dict[str, list[str]] = {}
        for s in by_w.get(w["id"], []):
            exercises.setdefault(s["exercise"], []).append(f"{s['weight']:g}{s['unit']} x {s['reps']}")
        sessions.append({**w, "exercises": [{"name": k, "sets": v} for k, v in exercises.items()]})
    return {"from": date_from, "to": date_to, "sessions": sessions, "best_e1rm": best}
