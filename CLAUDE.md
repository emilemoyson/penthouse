# Emile's Hub

Private personal dashboard. Home page is a 3D cosy apartment at night (React Three Fiber) with four clickable rooms that open glass panels with live data. Classic tabs (Training, Jobs, Habits) live under `src/app/(app)`.

## Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind v4 (custom classes in `@layer components` in `globals.css`)
- Postgres via the `postgres` package (Neon in production). Schema is created on first query in `src/lib/db.ts` and re-run when `SCHEMA.length` changes. Seed data imports once (kv key `seeded`).
- R3F v9, drei v10, @react-three/postprocessing v3, zustand
- Auth: single password. `src/middleware.ts` checks an HMAC cookie `hub_session` (secret is `"hub:" + APP_PASSWORD`).
- Hosting plan: Vercel (free) + Neon (free). Not deployed yet.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill APP_PASSWORD and DATABASE_URL at minimum
npm run dev                  # http://localhost:3000
```

For a local database: `brew install postgresql@16 && brew services start postgresql@16 && createdb hub`, then `DATABASE_URL=postgres://localhost/hub`.

Check before committing: `npx tsc --noEmit` and `npm run build`.

## Env vars

| Var | What |
| --- | --- |
| `APP_PASSWORD` | login password |
| `DATABASE_URL` | Postgres |
| `JOBS_SHEET_URL`, `JOBS_SHEET_TOKEN` | Apps Script web app over the "Job Search 2027" Google Sheet (`apps-script/JobsFeed.gs`) |
| `INGEST_TOKEN` | Bearer token for `POST /api/ingest/:kind` |

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
- `POST /api/ingest/:kind` (sleep, meals, emails, events) with `Authorization: Bearer $INGEST_TOKEN`. Validated with zod, idempotent upserts. Examples in README.

## Gotchas

- Use `performance.now()` for animations that must finish (camera), not frame deltas; slow GPUs otherwise never arrive.
- Canvas `ctx.filter` blur per shape is very slow; blur by downscaling and upscaling instead.
- Floor slab top sits at y = -0.01 to avoid z-fighting with the floor plane.
- Recharts v3 tooltip payload types are readonly; see the custom `TipProps`.
- Server components can't pass functions to client components; pass a string (e.g. `format="pace"`).

## Style

The owner prefers plain, understated wording in UI copy and docs. No em dashes.

## Open items

- Push to GitHub and deploy on Vercel + Neon.
- Strava / Garmin import for runs and sleep.
- Nightly Gmail summary job posting to `/api/ingest/emails`.
