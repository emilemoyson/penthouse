import { describe, expect, it } from "vitest";

// Integration checks against a running dev server on the hub_test copy. verify.sh sets both variables;
// without them the suite is skipped, so `npm test` alone never touches a database.
const base = process.env.INGEST_BASE_URL;
const token = process.env.INGEST_TOKEN_FOR_TESTS;
const post = (kind: string, body: unknown, auth = true) =>
  fetch(`${base}/api/ingest/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

describe.skipIf(!base || !token)("POST /api/ingest/:kind", () => {
  const todo = { id: "vitest-todo-1", title: "Vitest check", due: "2099-01-01", sender: "vitest" };

  it("refuses a missing or wrong token", async () => {
    expect((await post("todos", [todo], false)).status).toBe(401);
    const bad = await fetch(`${base}/api/ingest/todos`, { method: "POST", headers: { Authorization: "Bearer nope", "Content-Type": "application/json" }, body: "[]" });
    expect(bad.status).toBe(401);
  });
  it("rejects an invalid body with 422", async () => {
    expect((await post("todos", [{ id: "x" }])).status).toBe(422);
    expect((await post("sleep", { date: "nope" })).status).toBe(422);
  });
  it("rejects an unknown kind", async () => {
    expect((await post("nonsense", {})).status).toBeGreaterThanOrEqual(400);
  });
  it("accepts a to-do and an identical re-send (upsert)", async () => {
    for (let i = 0; i < 2; i++) {
      const r = await post("todos", [todo]);
      expect(r.status).toBe(200);
      expect((await r.json()).ok).toBe(true);
    }
  });
  it("accepts a sleep night and a re-send", async () => {
    for (let i = 0; i < 2; i++) expect((await post("sleep", { date: "1999-01-01", totalMin: 420, source: "vitest" })).status).toBe(200);
  });
});
