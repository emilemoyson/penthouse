# Status

Updated 2026-10-20. Everything runs locally (`npm run dev`, Postgres on 5433). Jobs and Office are live, Kitchen is live with Lidl receipts.

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
