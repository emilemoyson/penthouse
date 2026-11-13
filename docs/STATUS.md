# Status

Updated 2026-11-04. Everything runs locally (`npm run dev`, Postgres on 5433). Jobs and Office are live, Kitchen is live with Lidl receipts.

## Course roadmap (2026-11-04)

The IENYC "Be a Master in Claude" plan is in `docs/ROADMAP.md` (5 items, one session each, deadline Sun Nov 15, moved from Thu Nov 12).

### Item 1: MCP server, done (branch `mcp-server`, committed and pushed 2026-11-13)

- `mcp/`: Python server on the `mcp` SDK 2.3 (`MCPServer`, the new name for FastMCP). 7 tools, 2 resources, the `weekly-review` prompt. Details, setup and 3 example conversations in `mcp/README.md`.
- Reads go through the role `penthouse_ro` (`mcp/sql/readonly_role.sql`: SELECT only, read-only transactions). It exists in the local Homebrew cluster with grants on `hub_test` only, not on `hub` or Neon yet. `import_receipts` writes only through `/api/ingest/groceries`.
- Checked: 20 pytest tests pass. STDIO and HTTP were tried for real (HTTP: 401 without the token, 200 with it). A real import into `hub_test` through a dev server saved 2 receipts, and a re-run answered "Already saved". 3 headless Claude Code conversations are recorded in the README. `tsc` is clean.
- Findings: sampling, roots and client logging are deprecated in the MCP 2026-07-28 spec (SEP-2577), but the SDK still supports them. The server uses them through `Resolve(...)`, which works on old and new protocol versions. Claude Code doesn't support sampling, so the two sampling tools fall back to numbers plus a note there. Claude Code does share roots (the project folder).
- `mcp/.env` (git-ignored) points at `hub_test`, which is kept so Emile can try the server in Claude Code. To use real data later: apply the role SQL to `hub` (or Neon) and change the URL. When done testing: `dropdb -p 5433 hub_test`.
- The 3D work is committed locally on `kitchen-sample` as `a18cc71` (WIP, not pushed).
- Next: item 2 (skills) in a new session. `weekly-food-report` should use `weekly_summary` and `get_meals`.

## 3D home: kitchen sample, "clean and Apple-like" (2026-10-20, branch `kitchen-sample`, not committed)

Emile chose the clean, Apple-like direction and wants to react to one room before the rest. Done so far (production build, MacBook Air, full quality):
- Overview 17 → 50 fps, draw calls 2,219 → 546; kitchen flight 23 fps with a 104 ms stutter → 50 fps, worst 64 ms; loading freezes 55 (6.6 s, worst 2.6 s) → 6 (1.5 s, worst 1.1 s, now behind the loading curtain).
- How: no shadowed point lights (25 lights, 4 with live shadows); candles are bloom only; moon shadow drawn once (`ShadowOnce`); static batching of non-moving meshes (`scene/batch.ts`, 752 → 155); rounded boxes from three-stdlib, cached (`Block` in `look/decor.tsx`); no mirror floor; shaders compiled before the curtain lifts (`Warmup`, `Curtain`); resolution scales before dropping to "low".
- Look: N8AO ambient occlusion (transparency mode forced off, it re-rendered the scene twice), soft `Environment` lightformers, lighter lens (no grain, gentle vignette and depth of field), calmer panel frame and cards, smootherstep camera, reduced motion respected.
- Measure with `?stats=1`; a local production build can run beside the dev server with `NEXT_DIST_DIR=.next-prod`.
- Not done yet: kitchen materials, rounder characters. Waiting on Emile's reaction before the other rooms.
- Next session: Emile found the visible change too small for the time spent. Agreed next step is one bold visible pass over the whole house in one go (smooth rounded characters, real materials, designed light per room, a real panel redesign), with before and after screenshots of every room at the end and no measuring at every step. Optionally first a private Vercel preview of this branch (needs Emile's OK to commit and push the branch).

## Deployed (2026-10-20)

- Live at https://penthouse-ashen.vercel.app (Vercel Hobby + Neon free, US East). Use this permanent address; the per-deploy `penthouse-<hash>-moyson.vercel.app` ones sit behind Vercel's own login and change every deploy.
- Local data copied to Neon with the pg_dump command below (counts matched). `scripts/.env` now points `INGEST_URL` at the live site with a new `INGEST_TOKEN`; the Lidl sync answered "Already saved." for the Oct 19 receipt. New `APP_PASSWORD` set. `GOOGLE_CALENDAR_ICS_URL` is set on Vercel but not in the local `.env.local`.
- Still to do: `SITE_URL` in the calendar task; the Neon password was shown in chat and Emile chose not to reset it.
- Course priorities after the deploy (see memory): receipt eval, own MCP server, plugin, project skills and verifier, then 3D polish.

## Earlier plan: deploy, then polish the 3D home (2026-10-20)

Plan: `~/.claude/plans/can-you-please-help-rustling-scott.md`. All work is committed and on `main` (758c4ec). Production build is about 2.6 MB of JS against 22 MB in dev, which is most of the slowness Emile sees locally. Data copy to Neon is tested (twice into a scratch db, counts match): `pg_dump --no-owner --no-acl --clean --if-exists -p 5433 hub | psql -v ON_ERROR_STOP=1 "$(pbpaste)"` with the Neon URL on the clipboard. A new `JOBS_SHEET_TOKEN` means running `createToken` again in the JobsFeed Apps Script. Then measure the 3D home in production (plan step 2).

## Next up

1. Deploy: import the GitHub repo on vercel.com, add Neon (Storage), set env vars. Use new values for `APP_PASSWORD`, `INGEST_TOKEN` and `JOBS_SHEET_TOKEN` (the old ones showed in a screenshot). Add `ANTHROPIC_API_KEY` too.
2. After deploy: point `scripts/.env` `INGEST_URL` at the Vercel URL so the Lidl sync works without the laptop server.
3. Gym: the Apple Notes sync is built (see below). Emile installs `scripts/com.emile.gym-sync.plist`. The iPhone Shortcut is no longer needed.
4. Morning inbox: now summaries only. Paste `automation/morning-inbox.md` (with the site URL and token) into a scheduled task and run it once.
5. MyFitnessPal: install `scripts/com.emile.mfp-sync.plist` and test with `--dry-run` first.

## Calendar and email task (2026-10-20)

- The penthouse calendar and the Habits "Up next" list read Google Calendar only, through `GOOGLE_CALENDAR_ICS_URL` (`src/lib/gcal.ts`, 5 min cache). The `events` table, its Habits form and `/api/ingest/events` are retired; the table is kept but unread. Its upcoming events are on Google Calendar.
- The desktop task `trig_01JATiHxRstnTWu9D8mWAsz1` (was "IENYC Daily Sync") gets `automation/calendar-agent.md`: Gmail + Outlook → Google Calendar (with a `#kind` tag) and to-dos → `/api/ingest/todos`. Blackboard and Notion only in the 11:00 run. It no longer writes the Ledger artifact.
- To-dos need the site reachable from the task. Until the deploy they fall back to the run summary. After the deploy: set `SITE_URL` in the task to the Vercel URL and add `GOOGLE_CALENDAR_ICS_URL` on Vercel.

- Still to do (2026-10-20): (1) Emile pastes the new prompt into the task in the desktop app (token filled in from the clipboard). (2) Then switch the task to hourly with RemoteTrigger update (`cron_expression` `CRON_TZ=America/New_York 0 * * * *`, name "Email → Calendar + To-dos (Gmail + Outlook)"), changing only those two fields. (3) Run it once and read the log (`list_runs`, `get_run_log`): check Outlook was read, events tagged, to-dos posted or listed. (4) Emile adds `GOOGLE_CALENDAR_ICS_URL` to `.env.local`, then check the calendar panel and Habits page. Old prompt backup: `automation/ienyc-daily-sync.old.md`. Code is on branch `google-calendar`, not committed.

## Gym note sync (2026-10-20)

- `scripts/gym_sync.py` + agent `.claude/agents/gym-data-parser.md` + `/api/ingest/gym-note`. Tested on a copy: adopts the 7 imported sessions without duplicates, an unchanged note exits in under a second, a new line becomes the next session. Details in `scripts/CLAUDE.md`.
- Real DB: the 7 sessions are now note sessions with Emile's dates (Push Mondays Sep 21 to Oct 12, Pull Wednesdays Sep 30 to Oct 14).
- Emile doesn't write dates. Skipped exercises need a lone `x` so lines stay aligned.
- Still to do: install the launchd job; after the deploy it posts to Vercel like the other syncs. Code on branch `google-calendar`, not committed.

## Kitchen chat and receipt sizes (2026-10-20)

- The ground beef came in as 1 lb when it was 2 lb: Lidl receipts have no size for packaged items and Claude guessed the smallest pack. Now the store and price go into the guess (tested: beef $7.99 and yogurt $3.49 both come out at 907 g), and guessed sizes are flagged "check size" in the fridge.
- Kitchen chat in the panel, under the Fridge: say what you cooked, it proposes a card (used, left, eaten, meal prep), Save logs it. Tested on a copy: tacos and pasta cooks, a vague "some chicken" (it asks how much), a size fix, and undo by deleting the meal.
- Code on branch `google-calendar`, not committed. The real database gets the `size_guessed` column on the next query (existing items start unflagged).

## Later

- Kitchen: test a receipt photo and a typed list in the panel. Feature ideas: saved recipes, shopping list, price history, "what can I cook" button, weekly summary, waste tracking.
- The scroll-into-the-sky view (`src/penthouse/rise.ts`): Emile has tweaks in mind; ask.
- Strava / Garmin import for runs and sleep.
- Claude Code setup, roadmap steps 3 to 6: project skills (`verify`, `test-on-copy`, `ship`, `new-ingest-kind`, `lidl`), subagents (`verifier`, `sync-debugger`), then the scheduled Gmail agent.
