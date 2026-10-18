# Emile · personal dashboard

A private website. The home page is a 3D penthouse at night (React Three Fiber): click the bed, desk, gym or kitchen and the camera flies in while a glass panel shows that area's data. The classic pages sit behind it:

- **Training**: log workouts (sets, reps, weight) and runs; coach-style insights, lift progress, weekly volume per muscle, running trends.
- **Jobs**: live view of the *Job Search 2027* Google Sheet: pipeline, weekly targets, what to apply to next, outreach drafts.
- **Habits**: daily check-in (reading, Zetamac, gym/run filled in from Training), quant prep, Master in Claude, reading.

Built with Next.js, Tailwind and Postgres. Password-protected; search engines are told not to index it.

## Deploy (about 15 minutes, all free)

1. **GitHub**: create a new *private* repository and upload this folder (everything except `node_modules` and `.next`).
2. **Vercel**: sign in at vercel.com with GitHub → *Add New → Project* → import the repo. Under *Environment Variables* add `APP_PASSWORD`, then Deploy.
3. **Database**: in the Vercel project → *Storage* → *Create Database* → **Neon** (free) → connect it to the project. This adds `DATABASE_URL` for you.
4. **Jobs sheet**: follow the steps at the top of `apps-script/JobsFeed.gs`, then add `JOBS_SHEET_URL` and `JOBS_SHEET_TOKEN` under *Settings → Environment Variables*. Add `INGEST_TOKEN` (any long random string) too, for the data endpoints.
5. *Deployments* → ⋯ → **Redeploy** so the new variables are picked up. Open the URL and sign in.

Tables are created on first load, and your gym notes, old Ledger logs and events are imported once.

## The penthouse (src/penthouse)

A cosy apartment at night: oak floors, linen curtains, a bouclé sofa, plants, warm lamps and the city through the glass. Everything (furniture, the four characters, textures, the skyline) is built in code, so there are no model files to load.

```
store.ts                  zone + camera phase (overview → flying → focused → returning), quality
zones.ts                  the 4 zones: anchors, camera poses, lens (fov), colours, keys, overview pose
look/textures.ts          canvas textures: oak floor, plaster, fabric, marble, rugs, art prints, screens, book spines
look/decor.tsx            palette, Block (rounded box), plants, lamps, candles, books, frames, vases, mugs
look/furniture.tsx        bed, nightstands, bench, desk + monitor + laptop, office chair, gym kit, fluted island,
                          stools, sage back kitchen, fridge, sofa, lounge chair, coffee table, record console,
                          bookshelf, curtains
characters/outfits.ts     wardrobe + hair: Emile and three helpers (sleep, coach, chef)
characters/Character.tsx  smooth stylised character + idle loops (sleep, type, squat, stretch, cycle, walk, prep)  ← GLB hook here
scene/Room.tsx            shell (floor, glass wall, curtains, plaster wall, city) + living room
zones/*.tsx               layout + lights + character per zone (Kitchen.tsx has the walk loop / pathfinding hook)
scene/CameraRig.tsx       eased Bézier camera flights, FOV dolly, panel-aware view offset, DOF focus point
scene/Scene.tsx           canvas, lights, depth of field + bloom + grain + vignette, quality switch
data/types.ts             payload contracts for the four panels
data/server.ts            loaders (DB, job sheet) with labelled sample fallbacks
data/hooks.ts             useSleepData / useProfessionalData / useFitnessData / useNutritionData
overlays/panels.tsx       frosted glass panels
```

Controls: drag to orbit, scroll to zoom, click a room or press 1–4, Esc to zoom out. `?quality=low|high`.

Full view: in a room, scroll down anywhere (or press "Full view"). The camera rises out of the room into the night sky and that room's page slides up over it. Scroll back up at the top of the page, press Esc or click the sky to come back down. The sheet (`src/penthouse/overlays/Sheet.tsx`) shows the normal page in a same-origin iframe, where it hides its nav and background.

## Feeding it real data

`POST /api/ingest/:kind` with `Authorization: Bearer $INGEST_TOKEN`. One object or an array; re-sending is safe.

```bash
# a night of sleep (from a Garmin/garth script, Oura, WHOOP, Apple Health export…)
curl -X POST https://YOUR-SITE/api/ingest/sleep -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"date":"2026-10-15","totalMin":447,"deepMin":81,"remMin":104,"lightMin":243,"awakeMin":19,"recovery":81,"hrv":64,"rhr":51,"bedtime":"23:52","waketime":"07:39"}'

# meals (or just use "Add meal" in the kitchen panel)
curl -X POST .../api/ingest/meals  -d '{"date":"2026-10-15","time":"08:30","name":"Eggs, toast, avocado","kcal":540,"protein":28,"carbs":42,"fat":28}'

# AI email summaries (from a nightly Gmail + Claude job)
curl -X POST .../api/ingest/emails -d '{"id":"gmail-msg-id","receivedAt":"2026-10-15T13:05:00Z","sender":"Recruiter","subject":"Next steps","bullets":["Assessment link inside","Due Friday"],"tag":"Job"}'

# calendar events (kind: school | personal | meeting | deadline)
curl -X POST .../api/ingest/events -d '{"date":"2026-10-22","title":"Tech Summit","kind":"school","time":"6:30 PM","location":"64 Wooster St"}'

# to-dos pulled from emails (re-sending never un-ticks a done item; threadId adds an "Email" link)
curl -X POST .../api/ingest/todos -d '{"id":"msg123-1","title":"Complete online assessment","due":"2026-10-24","sender":"Acme","threadId":"18c2..."}'

# a gym note in the docs/gym-template.md format (the iPhone "Log workout" Shortcut)
curl -X POST .../api/ingest/workout-text -d '{"text":"Push\nSat 17 Oct\nFlat DB press\n50 x 8"}'
```

Where each source comes from:

- **Gym:** iPhone Notes with the template in `docs/gym-template.md`, sent by the Shortcut in `docs/shortcuts.md`.
- **Inbox, to-dos, calendar:** the Claude Desktop morning task, prompt in `automation/morning-inbox.md`.
- **Food:** `scripts/mfp_sync.py` reads the MyFitnessPal diary through your Chrome login, scheduled by `scripts/com.emile.mfp-sync.plist` (setup in the script header).
- **Jobs:** the Google Sheet, through `apps-script/JobsFeed.gs`.

Panels read `GET /api/penthouse/:zone` (sleep, professional, fitness, nutrition) and refresh on an interval and on tab focus. Anything not connected yet is shown with a "Sample data" badge.

## Later

- **Strava / Garmin**: runs already have a `source` column. A Strava sync can write rows with `source = 'strava'`; Garmin is easiest via its Strava sync.
- **Settings**: weekly targets and the weight unit live in the `kv` table under `training_settings` (`{"unit":"lb","gymTarget":3,"runTarget":2}`).

## Local development

```bash
cp .env.example .env.local   # fill in DATABASE_URL and APP_PASSWORD
npm install
npm run dev
```
