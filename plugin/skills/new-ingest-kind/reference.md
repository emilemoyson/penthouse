# Where `sleep` lives (the pattern to copy)

| Piece | File | Look for |
| --- | --- | --- |
| zod schema | `src/app/api/ingest/[kind]/route.ts` | `const Sleep = z.object(` |
| kind list (doc comment) | same file, top | `POST /api/ingest/:kind` |
| auth | same file | `function authorised` (bearer `INGEST_TOKEN`, don't change) |
| upsert | same file | `case "sleep":` inside `switch (kind)` |
| table | `src/lib/db.ts` | `create table if not exists sleep_logs` |
| loader | `src/penthouse/data/server.ts` | `getSleepData`, `const LOADERS` |
| hook | `src/penthouse/data/hooks.ts` | `useSleepData` |
| panel | `src/penthouse/overlays/panels.tsx` | the sleep panel |
| README example | `README.md` | `api/ingest/sleep` |
| middleware | `src/middleware.ts` | `/api/ingest/` is already open to bearer auth; nothing to add |

Kinds with special logic (`groceries`, `workout-text`, `gym-note`) have their own `ingestX` function above the switch. Only use that shape if the new kind needs more than one table or a Claude call.
