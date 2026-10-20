# The 3D home

- `Penthouse.tsx`: page shell (clock, dock, labels, panel). `store.ts`: zone, camera phase, quality.
- `zones.ts`: anchor, label height, camera pose and fov per room, plus `overviewPose(aspect)` (portrait has its own pose), and the `href` each room's full page opens.
- `scene/Scene.tsx`: canvas, lights, post effects. `scene/Room.tsx`: shell and living room. `scene/CameraRig.tsx`: wall-clock eased Bezier flights, FOV dolly, view offset so the subject sits beside the panel.
- `zones/{Bed,Desk,Gym,Kitchen}.tsx`: furniture layout, lights and the character for each room.
- `look/`: everything visual is procedural. `textures.ts` (canvas textures, cached), `decor.tsx` (palette `C`, `Block`, plants, lamps, small objects), `furniture.tsx`.
- `characters/Character.tsx`: stylised character with idle loops; `outfits.ts` holds clothes and hair. A GLB can replace it at the marked hook, keeping the same props.
- `overlays/`: glass panels. `panels.tsx` (sleep, office, gym, shared `SourceBar`/`Tabs`), `kitchen.tsx` (kitchen panel), `Sheet.tsx` (full page in an iframe).
- Room layout (metres, y up): floor 18 x 12 centred on origin, glass wall at z = -6, plaster wall at x = -9. Bedroom back-left, office back-right, gym front-left, kitchen front-right, living room centre.
- Labels are plain DOM elements projected each frame (`LabelProjector`), not drei `Html`.
- Quality: `?quality=low|high`. Low turns off shadows, reflections and the lens stack. Phones start on low; `PerformanceMonitor` drops to low on slow devices.

## The rise (`rise.ts`)

In a focused room, scrolling drives one 0 to 1 value. `CameraRig` eases it each frame and cranes the camera into the sky, `scene/NightSky.tsx` fades a star dome in, the panel fades out, and `overlays/Sheet.tsx` slides the room's page up in a same-origin iframe. Letting go part-way snaps to the nearer end; scrolling up at the top, Esc or a click on the sky goes back down. In a frame, the root layout adds `html.embedded`, which hides `[data-app-nav]` and the page background. Intercepting routes were tried and dropped: Next 15 throws "initialTree is not iterable" because the pages live in the `(app)` group with their own layout. Emile has more tweaks in mind here; ask.

## Gotchas

- Use `performance.now()` for animations that must finish (camera), not frame deltas; slow GPUs otherwise never arrive.
- The camera tween must run to p = 1 even after `arrive()` flips the phase to "focused"; the rise only takes over once `tween.current` is null.
- Canvas `ctx.filter` blur per shape is very slow; blur by downscaling and upscaling instead.
- Floor slab top sits at y = -0.01 to avoid z-fighting with the floor plane.
