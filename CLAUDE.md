# Emile's Hub

Private personal dashboard. Home page is a 3D cosy apartment at night (React Three Fiber) with four clickable rooms that open glass panels with live data. Classic tabs (Training, Kitchen, Jobs, Habits) live under `src/app/(app)`.

## Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind v4 (custom classes in `@layer components` in `globals.css`)
- Postgres via the `postgres` package (Neon in production). Schema is created on first query in `src/lib/db.ts` and re-run when `SCHEMA.length` changes. Seed data imports once (kv key `seeded`).
- R3F v9, drei v10, @react-three/postprocessing v3, zustand
- Auth: single password. `src/middleware.ts` checks an HMAC cookie `hub_session` (secret is `"hub:" + APP_PASSWORD`).
- Hosting plan: Vercel (free) + Neon (free). Code is on GitHub (private): github.com/emilemoyson/penthouse. Not deployed on Vercel yet.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill APP_PASSWORD and DATABASE_URL at minimum
npm run dev                  # http://localhost:3000
```

For a local database: `brew install postgresql@16 && brew services start postgresql@16 && createdb hub`, then `DATABASE_URL=postgres://localhost/hub`. On Emile's Mac the Homebrew Postgres runs on port 5433 (an EDB PostgreSQL 18 owns 5432), so it's `postgres://localhost:5433/hub`.

Check before committing: `npx tsc --noEmit` and `npm run build`.

## Env vars

| Var | What |
| --- | --- |
| `APP_PASSWORD` | login password |
| `DATABASE_URL` | Postgres |
| `JOBS_SHEET_URL`, `JOBS_SHEET_TOKEN` | Apps Script web app over the "Job Search 2027" Google Sheet (`apps-script/JobsFeed.gs`) |
| `INGEST_TOKEN` | Bearer token for `POST /api/ingest/:kind` |
| `ANTHROPIC_API_KEY` | Claude API: reads receipt photos and typed grocery lists, estimates macros (`src/lib/receipt.ts`). Optional |

Never commit `.env.local`.

## The 3D home (`src/penthouse`)

- `Penthouse.tsx`: page shell (clock, dock, labels, panel). `store.ts`: zone, camera phase, quality.
- `zones.ts`: anchor, label height, camera pose and fov per room, plus `overviewPose(aspect)` (portrait has its own pose).
- `scene/Scene.tsx`: canvas, lights, post effects. `scene/Room.tsx`: shell and living room. `scene/CameraRig.tsx`: wall-clock eased Bézier flights, FOV dolly, view offset so the subject sits beside the panel.
- `zones/{Bed,Desk,Gym,Kitchen}.tsx`: furniture layout, lights and the character for each room.
- `look/`: everything visual is procedural. `textures.ts` (canvas textures, cached), `decor.tsx` (palette `C`, `Block`, plants, lamps, small objects), `furniture.tsx`.
- `characters/Character.tsx`: stylised character with idle loops; `outfits.ts` holds clothes and hair. Swap in a GLB later at the marked hook, keeping the same props.
- Room layout (metres, y up): floor 18 x 12 centred on origin, glass wall at z = -6, plaster wall at x = -9. Bedroom back-left, office back-right, gym front-left, kitchen front-right, living room centre.
- Labels are plain DOM elements projected each frame (`LabelProjector`), not drei `Html`.
- Quality: `?quality=low|high`. Low turns off shadows, reflections and the lens stack. Phones start on low; `PerformanceMonitor` drops to low on slow devices.

## Data

- `src/penthouse/data/server.ts` loads each panel (DB + jobs sheet) with labelled sample fallbacks; `hooks.ts` refreshes via `GET /api/penthouse/:zone` (sleep, professional, fitness, nutrition).
- `POST /api/ingest/:kind` (sleep, meals, groceries, emails, events, todos, workout-text) with `Authorization: Bearer $INGEST_TOKEN`. Validated with zod, idempotent upserts. Examples in README.
- Gym notes: `src/lib/parse-workout.ts` reads the `docs/gym-template.md` format. Shortcut imports are `workouts.source = 'shortcut'` and are replaced per (date, kind) on re-send.
- Kitchen: shop → fridge → cook → meal. `grocery_runs` and `pantry_items` (amounts in g, ml, item or serving; macros per 100 g/ml or per item/serving; `price` is for `qty_start`). Shared math in `src/lib/kitchen.ts` (client-safe). `src/lib/groceries.ts` saves a shop and fills missing macros: Open Food Facts by barcode first (only when the package size is known), then one Claude call. `cookMeal` in `src/penthouse/data/actions.ts` logs one serving with cost and keeps extra servings as a leftovers item. `meals.cost` and `meals.kind` (home | out) drive the spending numbers. Panel UI is `src/penthouse/overlays/kitchen.tsx`; full page is `/kitchen`. Deleting a meal does not put the food back in the fridge.
- Receipts: `src/lib/receipt.ts` uses `claude-opus-5-5` with structured output (`betaZodOutputFormat`), effort low, server-side fallbacks on. The panel shrinks photos to about 1800px JPEG before the server action (`next.config.ts` allows 6 MB bodies).
- Lidl Plus: `scripts/lidl_sync.py` in its own venv `scripts/.venv-lidl` (its dependencies clash with the myfitnesspal pins). Login is `scripts/lidl_login.py`: a visible Chrome window where Emile logs in by hand (Lidl's 2026 login page has a captcha, so the package's `lidl-plus auth` automation no longer works); it catches the `com.lidlplus.app://callback?code=` redirect and saves `LIDL_REFRESH_TOKEN`. selenium-wire needs `blinker==1.7.0` and `pyopenssl==24.2.1` (pinned in `scripts/requirements-lidl.txt`). Uses the unofficial `lidl-plus` package for the token and the receipt list, then fetches the v3 printed receipt (HTML) itself because the package's `ticket()` is broken since Lidl's 2024 API change. Works with Emile's US account (tested 2026-10-19). Send only `Authorization` and a 2-letter `Accept-Language: en`: the package's fake `App-Version: 999.99.9` headers make Akamai stall every request, and the v3 receipt call 400s on `en-US`. The receipt is cut before the payment block (card data never leaves the Mac), food lines are parsed locally (`F`/`FT` flag = food, `T` = non-food, discounts and `lb @` weights handled), and the run total is the food lines only. Sent as items with `extId = lidl:<id>`; the endpoint skips known ids before calling Claude. The refresh token is renewed and saved before fetching, in case Lidl rotates it.
- MyFitnessPal: `scripts/mfp_sync.py` (Python venv in `scripts/.venv`, env in `scripts/.env`). Days with `source = 'mfp'` meals ignore manual rows in the kitchen panel.
- The rise (`src/penthouse/rise.ts`): in a focused room, scrolling anywhere drives one 0 to 1 value. `CameraRig` eases it each frame and cranes the camera from the zone pose into the sky, `scene/NightSky.tsx` fades a star dome in, the panel fades out, and `overlays/Sheet.tsx` slides the room's page (`zones.ts` `href`) up in a same-origin iframe. Letting go part-way snaps to the nearer end; scrolling up at the top of the page, Esc or a click on the sky goes back down. In a frame, the root layout's script adds `html.embedded`, which hides `[data-app-nav]` and the page background (`globals.css`). Intercepting routes were tried and dropped: Next 15 throws "initialTree is not iterable" because the target pages live in the `(app)` group with their own layout.

## Gotchas

- Use `performance.now()` for animations that must finish (camera), not frame deltas; slow GPUs otherwise never arrive.
- The camera tween must run to p = 1 even after `arrive()` flips the phase to "focused"; the rise only takes over once `tween.current` is null.
- Canvas `ctx.filter` blur per shape is very slow; blur by downscaling and upscaling instead.
- Floor slab top sits at y = -0.01 to avoid z-fighting with the floor plane.
- Recharts v3 tooltip payload types are readonly; see the custom `TipProps`.
- Server components can't pass functions to client components; pass a string (e.g. `format="pace"`).

## Style

The owner prefers plain, understated wording in UI copy and docs. No em dashes.

## Open items (next session starts here)

Status on 2026-10-18: everything works locally (`npm run dev`, password in `.env.local`, Postgres on port 5433). The Jobs sheet feed is connected locally (`JOBS_SHEET_URL` / `JOBS_SHEET_TOKEN` in `.env.local`, Apps Script file `JobsFeed` lives next to Emile's Job Watcher script in the sheet; never replace that script).

1. Deploy: Emile imports the GitHub repo on vercel.com, adds Neon (Storage), and sets env vars `APP_PASSWORD` (a new strong one), `INGEST_TOKEN`, `JOBS_SHEET_URL`, `JOBS_SHEET_TOKEN` (local values are in `.env.local`).
2. After deploy: point `scripts/.env` `INGEST_URL` at the Vercel URL, install the MyFitnessPal launchd job (`scripts/com.emile.mfp-sync.plist`), and test with a breakfast of toast, eggs and avocado logged in the MyFitnessPal app (`scripts/mfp_sync.py --dry-run` first).
3. Build the iPhone "Log workout" Shortcut (`docs/shortcuts.md`) and send a real note in the `docs/gym-template.md` format.
4. Paste `automation/morning-inbox.md` (with the site URL and token) into the Claude Desktop morning task and run it once.
5. Emile has more tweaks in mind for the scroll-into-the-sky full view (`src/penthouse/rise.ts`); ask what they are.
6. Later: Strava / Garmin import for runs and sleep.
7. Kitchen (built 2026-10-19): `ANTHROPIC_API_KEY` is in `.env.local` and works (also add it on Vercel). The first Lidl receipt (Oct 19, $32.69 of food) is imported. The Lidl sync runs at 9:00, 13:00, 17:00, 20:00 and 22:30 via `~/Library/LaunchAgents/com.emile.lidl-sync.plist` (log `~/Library/Logs/lidl-sync.log`); it only imports while the site is reachable at `scripts/.env` `INGEST_URL` (localhost until deploy) and looks back 14 days, so missed runs catch up. Still to test by hand: a receipt photo and a typed list in the panel.
