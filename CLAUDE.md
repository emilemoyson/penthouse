# Emile's Hub

Private personal dashboard. Home page is a 3D apartment at night (React Three Fiber) with four rooms that open glass panels with live data. Classic pages (Training, Kitchen, Jobs, Habits) live under `src/app/(app)`.

Where things stand and what's next: `docs/STATUS.md`. Update it when a topic is finished, then start the next topic in a fresh session (`/clear`).

## Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind v4 (custom classes in `@layer components` in `globals.css`)
- Postgres via `postgres` (Neon in production). Schema lives in `src/lib/db.ts`, is created on first query and re-runs when `SCHEMA.length` changes.
- R3F v9, drei v10, zustand, recharts v3, zod v4, `@anthropic-ai/sdk`
- Auth: one password. `src/middleware.ts` checks the HMAC cookie `hub_session` (secret `"hub:" + APP_PASSWORD`).
- Code: github.com/emilemoyson/penthouse (private). Hosting plan: Vercel + Neon, not deployed yet.

## Map

| Path | What |
| --- | --- |
| `src/penthouse/` | 3D home: scene, rooms, characters, glass panels (own CLAUDE.md) |
| `src/penthouse/data/` | Panel data: `types.ts`, `server.ts` (reads), `actions.ts` (writes), `samples.ts` (own CLAUDE.md) |
| `src/app/(app)/` | Classic pages; `src/app/api/ingest/[kind]` takes data from Shortcuts and scripts |
| `src/lib/` | db, auth, parsers, kitchen math, receipt reading |
| `scripts/` | Python syncs for Lidl Plus and MyFitnessPal, launchd jobs (own CLAUDE.md) |
| `mcp/` | Penthouse MCP server (Python, `mcp` SDK 2.x): read-only role for reads, `/api/ingest` for writes. Venv `mcp/.venv` (Python 3.12), tests `mcp/.venv/bin/pytest mcp` against `hub_test`. See `mcp/README.md` |
| `apps-script/JobsFeed.gs` | Google Sheet feed for the Jobs tab |
| `automation/calendar-agent.md` | Prompt for the hourly email task: Gmail + Outlook → Google Calendar, and to-dos read from every email |
| `automation/morning-inbox.md` | Prompt for the morning Gmail summaries task |
| `src/lib/gcal.ts` | Reads Google Calendar (secret iCal URL) for the calendar panel and Habits page |

## Run and check

```bash
npm run dev                  # http://localhost:3000, needs .env.local
npx tsc --noEmit             # before every commit
npm run build                # before every commit
```

Local Postgres is Homebrew on port 5433 (`postgres://localhost:5433/hub`); an EDB Postgres owns 5432. Test risky changes on a copy: `createdb -p 5433 -T hub hub_test`, then `DATABASE_URL=postgres://localhost:5433/hub_test npx next dev -p 3001`, and `dropdb -p 5433 hub_test` after.

## Env vars

`APP_PASSWORD`, `DATABASE_URL`, `JOBS_SHEET_URL`, `JOBS_SHEET_TOKEN`, `INGEST_TOKEN` (bearer for `/api/ingest/:kind`), `ANTHROPIC_API_KEY` (optional, receipts and macro estimates), `GOOGLE_CALENDAR_ICS_URL` (secret iCal address, the only calendar source; the old `events` table is no longer read). All in `.env.local`; the Python scripts use `scripts/.env`.

## Rules

- Never commit, print or paste `.env.local` or `scripts/.env`. Check a key exists with `grep -c '^NAME=' file`, never by showing it. Hooks in `.claude/` enforce this.
- Never ask for Emile's passwords (Lidl, Google). They log in themselves.
- Card and payment data from receipts never leaves the Mac.
- The Jobs sheet also runs Emile's "Job Watcher" Apps Script. Never replace or edit it; the dashboard feed is the separate `JobsFeed` file.
- Commit only when asked; branch first if on main.

## Style

Plain, understated wording in UI copy and docs. No em dashes. Use they/them for Emile.

## Gotchas

- Server components can't pass functions to client components; pass a string (e.g. `format="pace"`).
- Recharts v3 tooltip payload types are readonly; see the custom `TipProps`.
- Odd type errors about `* 2.ts` files: iCloud copies. Delete them and `.next`.
