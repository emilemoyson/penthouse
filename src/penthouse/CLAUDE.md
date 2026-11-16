# The 3D home

- `Penthouse.tsx`: page shell (clock, dock, labels, panel). `store.ts`: zone, camera phase, quality.
- `zones.ts`: anchor, label height, camera pose and fov per room, plus `overviewPose(aspect)` (portrait has its own pose), and the `href` each room's full page opens.
- `scene/Scene.tsx`: canvas, lights, post effects. `scene/Room.tsx`: shell and living room. `scene/Neighbourhood.tsx`: the street, neighbouring buildings, cars and train outside, merged into a few unlit meshes. `scene/skyline.ts`: the painted Manhattan skyline (night texture, with a daytime twin on `userData.day`). `scene/Painterly.tsx`: the paint filter (`?paint=0` turns it off). `scene/CameraRig.tsx`: wall-clock eased Bezier flights, FOV dolly, view offset so the subject sits beside the panel.
- `zones/{Bed,Desk,Gym,Kitchen}.tsx`: furniture layout, lights and the character for each room.
- `look/`: everything visual is procedural. `textures.ts` (canvas textures, cached), `decor.tsx` (palette `C`, `Block`, plants, lamps, small objects), `furniture.tsx`.
- `characters/Character.tsx`: stylised character with idle loops; `outfits.ts` holds clothes and hair. A GLB can replace it at the marked hook, keeping the same props.
- `overlays/`: glass panels. `panels.tsx` (sleep, office, gym, shared `SourceBar`/`Tabs`), `kitchen.tsx` (kitchen panel), `Sheet.tsx` (full page in an iframe).
- Room layout (metres, y up): `ROOM` in Room.tsx is 11 x 10 x 3.6, glass wall at z = -5, brick wall at x = -5.5. The rooms sit in groups moved by `SHIFT` (zones.ts), which anchors and camera poses also use. Bedroom back-left, office back-right, gym front-left, kitchen front-right, living room centre.
- Time of day: `useZone().hour` (quarter hours, kept current by `Daylight`) drives lamps, street colours and the paint grade; `?hour=` overrides it.
- Labels are plain DOM elements projected each frame (`LabelProjector`), not drei `Html`.
- Quality: `?quality=low|high`. Low turns off shadows, reflections and the lens stack. Phones start on low; `PerformanceMonitor` drops to low on slow devices.

## Rooms and clicks

A focused room shows only its glass panel and chat. The full view (scroll to rise into the sky, `overlays/Sheet.tsx`) was removed on 2026-11-15; `Sheet.tsx` and `nudgeRise` in `rise.ts` are unused. A click on a room only counts if the pointer moved 6 px or less (`e.delta`), so dragging to turn the view never zooms in. Room hitboxes are deliberately small.

## Gotchas

- Use `performance.now()` for animations that must finish (camera), not frame deltas; slow GPUs otherwise never arrive.
- The camera tween must run to p = 1 even after `arrive()` flips the phase to "focused"; the rise only takes over once `tween.current` is null.
- Canvas `ctx.filter` blur per shape is very slow; blur by downscaling and upscaling instead.
- Floor slab top sits at y = -0.01 to avoid z-fighting with the floor plane.
