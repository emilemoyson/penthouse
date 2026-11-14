"""End-to-end through an in-memory MCP client, against the hub_test copy (never the real DB).

Run from the repo root:
  createdb -p 5433 -T hub hub_test && psql -p 5433 -d hub_test -f mcp/sql/readonly_role.sql
  mcp/.venv/bin/pytest mcp
"""

import json
import os

import anyio
import httpx
import psycopg
import pytest
from mcp import Client, types

TEST_DB = os.environ.get("TEST_RO_DATABASE_URL", "postgres://penthouse_ro@localhost:5433/hub_test")
TEST_OWNER_DB = os.environ.get("TEST_OWNER_DATABASE_URL", "postgres://localhost:5433/hub_test")
assert TEST_DB.endswith("/hub_test") and TEST_OWNER_DB.endswith("/hub_test"), "tests only run against hub_test"
os.environ["PENTHOUSE_RO_DATABASE_URL"] = TEST_DB
os.environ.pop("INGEST_URL", None)

from penthouse_mcp.server import NO_SAMPLING, app  # noqa: E402

SAMPLE = (
    "Lidl\n11/02/2026\nChicken thighs 7.99 F\n2.1 lb @ $3.80/lb\nBANANAS 1.29 F\nPaper towels 3.99 T\n"
    "Card **** 4321\n"
)


def owner_sql(query: str):
    with psycopg.connect(TEST_OWNER_DB, autocommit=True) as c:
        return c.execute(query).fetchall()


class Recorder:
    def __init__(self, roots=None, sample_text="Dish 1: tacos"):
        self.prompts, self.logs, self.progress = [], [], []
        self._roots, self._sample = roots, sample_text

    async def sampling(self, ctx, params):
        self.prompts.append(params.messages[0].content.text)
        return types.CreateMessageResult(role="assistant", content=types.TextContent(text=self._sample), model="test")

    async def list_roots(self, ctx):
        return types.ListRootsResult(roots=[types.Root(uri=f"file://{r}") for r in self._roots])

    async def log(self, params):
        self.logs.append(params.data)

    async def on_progress(self, progress, total, message):
        self.progress.append((progress, total, message))

    def client(self, sampling=True):
        return Client(
            app,
            sampling_callback=self.sampling if sampling else None,
            list_roots_callback=self.list_roots if self._roots is not None else None,
            logging_callback=self.log,
            log_level="info",
        )


def run(fn):
    return anyio.run(fn)


def data(result):
    assert not result.is_error, result.content
    return json.loads(result.content[0].text)


def test_lists_everything():
    async def go():
        async with Client(app) as c:
            tools = {t.name for t in (await c.list_tools()).tools}
            assert tools == {"get_pantry", "get_meals", "get_spend", "get_workouts", "what_can_i_cook", "weekly_summary", "import_receipts"}
            # resolver parameters are filled by the server, never exposed to the model
            cook = next(t for t in (await c.list_tools()).tools if t.name == "what_can_i_cook")
            assert set(cook.input_schema["properties"]) == {"servings", "notes"}
            assert [r.uri for r in (await c.list_resources()).resources] == ["penthouse://pantry"]
            assert [t.uri_template for t in (await c.list_resource_templates()).resource_templates] == ["penthouse://meals/{date}"]
            assert [p.name for p in (await c.list_prompts()).prompts] == ["weekly-review"]
    run(go)


def test_reads_match_the_database():
    n_open = owner_sql("select count(*) from pantry_items where finished_at is null and qty > 0")[0][0]
    n_meals = owner_sql("select count(*) from meals where date between '2026-10-01' and '2026-10-31'")[0][0]
    groceries = owner_sql("select coalesce(sum(total),0) from grocery_runs where date between '2026-10-01' and '2026-10-31'")[0][0]

    async def go():
        async with Client(app) as c:
            assert data(await c.call_tool("get_pantry", {}))["count"] == n_open
            assert data(await c.call_tool("get_meals", {"date_from": "2026-10-01", "date_to": "2026-10-31"}))["count"] == n_meals
            spend = data(await c.call_tool("get_spend", {"date_from": "2026-10-01", "date_to": "2026-10-31"}))
            assert spend["groceries"] == round(groceries, 2)
            assert set(spend["cost_per_meal"]) == {"home", "out"}
            gym = data(await c.call_tool("get_workouts", {"date_from": "2026-09-01", "date_to": "2026-10-31"}))
            assert gym["sessions"] and all(v["e1rm"] > 0 for v in gym["best_e1rm"].values())
    run(go)


def test_bad_input_is_a_clear_tool_error():
    async def go():
        async with Client(app) as c:
            r = await c.call_tool("get_meals", {"date_from": "last week", "date_to": "2026-10-31"})
            assert r.is_error and "date_from must be a date" in r.content[0].text
            r = await c.call_tool("get_pantry", {"place": "garage"})
            assert r.is_error
    run(go)


def test_cook_uses_sampling_with_only_pantry_items():
    rec = Recorder()

    async def go():
        async with rec.client() as c:
            out = data(await c.call_tool("what_can_i_cook", {"servings": 1, "notes": "high protein"}))
            assert out["ideas"] == "Dish 1: tacos" and out["note"] is None
            assert len(rec.prompts) == 1
            prompt = rec.prompts[0]
            assert "high protein" in prompt and "1 serving" in prompt
            for item in out["pantry"]:
                assert item["name"] in prompt
            assert all(i["days_left"] <= 3 for i in out["use_soon"])
    run(go)


def test_cook_without_sampling_returns_numbers_and_says_so():
    async def go():
        async with Recorder().client(sampling=False) as c:
            out = data(await c.call_tool("what_can_i_cook", {}))
            assert out["ideas"] is None and out["note"] == NO_SAMPLING and out["pantry"]
    run(go)


def test_weekly_summary_numbers_and_sampled_text():
    rec = Recorder(sample_text="Spent $40.")

    async def go():
        async with rec.client() as c:
            out = data(await c.call_tool("weekly_summary", {"week_start": "2026-10-19", "weekly_budget": 80}))
            assert out["from"] == "2026-10-19" and out["to"] == "2026-10-25"
            assert out["budget"] == {"weekly": 80, "left": round(80 - out["spend"]["total"], 2)}
            assert out["summary"] == "Spent $40."
            assert '"weekly": 80' in rec.prompts[0]
    run(go)


def test_import_refuses_without_roots_and_outside_roots(tmp_path):
    (tmp_path / "a.txt").write_text(SAMPLE)

    async def go():
        async with Recorder(roots=None).client() as c:
            r = await c.call_tool("import_receipts", {"folder": str(tmp_path)})
            assert r.is_error and "no roots" in r.content[0].text
        async with Recorder(roots=[tmp_path / "elsewhere"]).client() as c:
            r = await c.call_tool("import_receipts", {"folder": str(tmp_path)})
            assert r.is_error and "outside the client's roots" in r.content[0].text
        async with Recorder(roots=[tmp_path]).client() as c:
            r = await c.call_tool("import_receipts", {"folder": "/etc"})
            assert r.is_error and "outside" in r.content[0].text
    run(go)


def test_import_dry_run_reports_progress_and_logs(tmp_path):
    (tmp_path / "a.txt").write_text(SAMPLE)
    (tmp_path / "b.html").write_text("<div>Card **** 1111</div>")
    (tmp_path / "photo.jpg").write_bytes(b"\xff\xd8")
    rec = Recorder(roots=[tmp_path])

    async def go():
        async with rec.client() as c:
            r = await c.call_tool("import_receipts", {"folder": str(tmp_path)}, progress_callback=rec.on_progress)
            out = data(r)
            assert out["files"] == 2 and out["dry_run"] is True  # the photo is ignored
            a, b = out["results"]
            assert a["status"] == "dry run" and a["items"] == 2
            assert b["status"].startswith("skipped")
            assert "4321" not in json.dumps(out) and "1111" not in json.dumps(out)
            assert rec.progress[-1][:2] == (2, 2)
            assert any("2 food line" in str(m) for m in rec.logs)
            assert any("skipped" in str(m) for m in rec.logs)
    run(go)


def test_resources_and_prompt():
    async def go():
        async with Client(app) as c:
            pantry = json.loads((await c.read_resource("penthouse://pantry")).contents[0].text)
            assert isinstance(pantry, list) and pantry
            meals = json.loads((await c.read_resource("penthouse://meals/2026-10-20")).contents[0].text)
            assert all(m["date"] == "2026-10-20" for m in meals)
            p = await c.get_prompt("weekly-review", {"week_start": "2026-10-19"})
            assert "weekly_summary" in p.messages[0].content.text
    run(go)


def test_read_only_role_cannot_write():
    from penthouse_mcp import db

    async def go():
        async with db.connect() as conn:
            with pytest.raises(psycopg.Error):
                await conn.execute("insert into kv (key, value) values ('mcp_test', '1')")

    run(go)
    assert owner_sql("select count(*) from kv where key = 'mcp_test'")[0][0] == 0


def test_http_bearer_gate():
    from penthouse_mcp.http_auth import BearerAuth

    async def inner(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    token = "t" * 32
    asgi = BearerAuth(inner, token)

    async def go():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=asgi), base_url="http://x") as h:
            assert (await h.post("/mcp")).status_code == 401
            assert (await h.post("/mcp", headers={"Authorization": "Bearer wrong"})).status_code == 401
            assert (await h.post("/mcp", headers={"Authorization": f"Bearer {token}"})).status_code == 200
    run(go)
    with pytest.raises(ValueError):
        BearerAuth(inner, "short")
