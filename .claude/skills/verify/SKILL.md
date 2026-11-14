---
name: verify
description: Full check of the penthouse repo before a commit or after a change - TypeScript, Next build, MCP tests, then a live smoke test of /api/ingest on a throwaway hub_test copy of the database. Use when asked to verify, check, test or sanity-check the app or a change, or before committing. Not for reviewing code style or explaining code.
allowed-tools: Bash(.claude/skills/verify/verify.sh*), Read
---

# Verify

Run the script from the repo root and report what it says. Don't fix anything inside this skill.

```bash
.claude/skills/verify/verify.sh          # full: tsc, build, pytest mcp, hub_test smoke
.claude/skills/verify/verify.sh --quick  # tsc and pytest only, for small edits
```

Use `--quick` only when the change touched no route, schema or SQL. Anything under `src/app/api/`, `src/lib/db.ts` or `mcp/` gets the full run.

## What the script checks

1. `npx tsc --noEmit`
2. `npm run build`
3. `mcp/.venv/bin/pytest mcp` (against `hub_test`)
4. Copies `hub` to a fresh `hub_test` (with the read-only role the MCP tests use), starts `next dev` on port 3001 against the copy, then:
   - `POST /api/ingest/sleep` without a token returns 401
   - an invalid body returns 422
   - a valid record sent twice leaves exactly one row (idempotent)
   - the real `hub` database has no test rows
   It stops the server on exit, even after a failure. It drops `hub_test`, or leaves a fresh copy if one existed before (`mcp/.env` may point at it).

The token is read from `.env.local` inside the script and never printed. Don't print it yourself.

## Reporting

- Last line `VERIFY: ALL PASS`: say so in one line, with the pytest count.
- Otherwise: list each `FAIL` line, quote the shortest useful part of the log under it, and say what you think the cause is. Ask before fixing.
- If `createdb` fails, another session probably holds a connection to `hub` (the dev server on 3000). Say so instead of retrying.
