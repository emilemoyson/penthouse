# Scripts (run on Emile's Mac)

The syncs post to `INGEST_URL` (in `scripts/.env`, localhost until deploy) with `INGEST_TOKEN`. Never print `scripts/.env`.

## Lidl Plus (`lidl_sync.py`, `lidl_login.py`)

- Own venv `scripts/.venv-lidl` (`pip install -r scripts/requirements-lidl.txt`); its dependencies clash with the MyFitnessPal pins. selenium-wire needs `blinker==1.7.0` and `pyopenssl==24.2.1`.
- Login: `scripts/.venv-lidl/bin/python scripts/lidl_login.py` opens a visible Chrome window where Emile logs in by hand (the 2026 login page has a captcha). It catches the `com.lidlplus.app://callback?code=` redirect and saves `LIDL_REFRESH_TOKEN`.
- The unofficial `lidl-plus` package gives the token and the receipt list; the script fetches the v3 printed receipt (HTML) itself because the package's `ticket()` broke in 2024.
- Send only `Authorization` and a 2-letter `Accept-Language: en`. The package's fake `App-Version: 999.99.9` headers make Akamai stall every request, and the v3 receipt 400s on `en-US`.
- The receipt is cut before the payment block (card data never leaves the Mac). Food lines are parsed locally: `F`/`FT` flag = food, `T` = non-food, discounts apply to the line above, `lb @` weights handled. The run total is food lines only. Sent as items with `extId = lidl:<id>`; the endpoint skips known ids before calling Claude.
- The refresh token is renewed and saved before fetching, in case Lidl rotates it.
- Check without sending: `scripts/.venv-lidl/bin/python scripts/lidl_sync.py --dry-run`.
- Schedule: `com.emile.lidl-sync.plist` in `~/Library/LaunchAgents` at 9:00, 13:00, 17:00, 20:00, 22:30; log `~/Library/Logs/lidl-sync.log`. Looks back 14 days, so missed runs catch up. launchd jobs can't read `~/Documents` (macOS privacy), which is why the repo lives in `~/code`.

## Gym note (`gym_sync.py`)

- Reads the Apple Notes note "gym" with JXA (text + last-edited day). No venv: standard library, `/usr/bin/python3` (3.9).
- The note has no dates. Split header → exercise → one line per session, newest at the bottom; a lone `x` is a skipped week. Session n of a split = line n under each of its exercises.
- Parsing is the `gym-data-parser` agent (`.claude/agents/gym-data-parser.md`), run as `claude -p --agent gym-data-parser` with hooks, tools and MCP off and `--json-schema scripts/gym_schema.json`. The answer comes back in `result` as fenced JSON. About 4 to 7 cents a run, capped at $0.50.
- State in `~/Library/Application Support/hub/gym-sync.json`: hash of the last sent note (unchanged → exit, no Claude call), per-split session counts (the next run only re-reads each split's latest session and after), and a parsed-but-unsent result for when the site was down.
- Posts to `/api/ingest/gym-note` with `date` = the note's last-edited day, which becomes the date of new sessions.
- `--dry-run` prints without sending; `--full` re-reads every session (after fixing an old line). Test against a copy with `INGEST_URL=http://localhost:3001 GYM_STATE=<scratch file>`.
- Schedule: `com.emile.gym-sync.plist`, every 30 min; log `~/Library/Logs/gym-sync.log`. macOS asks once to let it control Notes.

## MyFitnessPal (`mfp_sync.py`)

Venv `scripts/.venv` (`requirements.txt`). Not scheduled yet: `com.emile.mfp-sync.plist` goes in after deploy. Try `--dry-run` first.
