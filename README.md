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
4. **Jobs sheet**: follow the steps at the top of `apps-script/JobsFeed.gs`, then add `JOBS_SHEET_URL` and `JOBS_SHEET_TOKEN` under *Settings → Environment Variables*.
5. *Deployments* → ⋯ → **Redeploy** so the new variables are picked up. Open the URL and sign in.

Tables are created on first load, and your gym notes, old Ledger logs and events are imported once.

## The penthouse (src/penthouse)

```
store.ts            zone + camera phase state (zustand): overview → flying → focused → returning
zones.ts            the 4 zones: camera poses, colours, labels, keyboard keys
scene/Scene.tsx     Canvas, lights, post-processing, quality switch (?quality=low|high)
scene/CameraRig.tsx damped camera travel + restricted OrbitControls + panel-aware view offset
scene/Room.tsx      floor, glass wall, skyline, living area
scene/skyline.ts    procedural night skyline texture (swap for a photo any time)
scene/Character.tsx placeholder mannequin with idle loops  ← drop your Ready Player Me GLB here
zones/*.tsx         furniture + character per zone (Kitchen.tsx has the walk loop / pathfinding hook)
overlays/           glass panels: Sleep, Professional Hub, Fitness, Nutrition
load.ts             server-side data for the panels (training, jobs sheet, calendar)
```

Live data: Fitness (Training tab), job grid (sheet) and calendar (events). Sleep, nutrition and inbox are clearly marked sample data until Garmin, a food log and Gmail are connected.

Controls: drag to orbit, scroll to zoom, click a room or press 1–4, Esc to zoom out.

## Later

- **Strava / Garmin**: runs already have a `source` column. A Strava sync can write rows with `source = 'strava'`; Garmin is easiest via its Strava sync.
- **Settings**: weekly targets and the weight unit live in the `kv` table under `training_settings` (`{"unit":"lb","gymTarget":3,"runTarget":2}`).

## Local development

```bash
cp .env.example .env.local   # fill in DATABASE_URL and APP_PASSWORD
npm install
npm run dev
```
