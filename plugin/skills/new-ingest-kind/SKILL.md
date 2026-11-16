---
name: new-ingest-kind
description: Adds a new data kind to the penthouse ingest API end to end - zod schema, Postgres table, upsert in /api/ingest/[kind], a data loader and panel, and a README curl example. Use when asked to add a new data source, data type, ingest kind or endpoint that feeds the penthouse (e.g. "log water intake", "accept steps from my phone"). Not for changing an existing kind or for the MCP server.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npx tsc --noEmit*), Bash(.claude/skills/verify/verify.sh*)
---

# New ingest kind

Copy how `sleep` is done; it is the simplest existing kind. Exact locations are in [reference.md](reference.md).

## Before writing code

Confirm with Emile in one short message: the kind name (kebab-case, plural if it's a list), the fields with types, the natural key that makes re-sends safe, and which zone shows it. Then build without further questions.

## Checklist (do all, in order)

1. **Schema** in `src/app/api/ingest/[kind]/route.ts`: a zod object next to `Sleep`. Dates use the shared `date` regex, counts use `int`, strings get a `.max()`, `source` defaults to `"api"`.
2. **Table** in `src/lib/db.ts`: `create table if not exists ...` beside `sleep_logs`, primary key = the natural key, plus `source` and `updated_at`.
3. **Upsert**: a `case` in the `switch (kind)` that accepts one object or an array and does `insert ... on conflict (<key>) do update`. Return `{ ok, kind, count }`.
4. **Doc comment**: add the kind to the list at the top of `route.ts` and to the header comment in `src/penthouse/data/server.ts`.
5. **Loader and panel**: a loader in `src/penthouse/data/server.ts`, registered in `LOADERS`; a hook in `hooks.ts`; the panel in `src/penthouse/overlays/panels.tsx`. Don't touch the 3D scene.
6. **README**: one `curl` line in the ingest section, matching the others.
7. **Verify**: run `.claude/skills/verify/verify.sh`. Then, on `hub_test`, send the README example twice and confirm one row.

Never test against the real `hub` database and never print `INGEST_TOKEN`.

Done means: verify passes, and you list the files you changed.
