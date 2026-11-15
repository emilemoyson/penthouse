I want the 3D home redesigned as a cosy Manhattan studio, and the whole thing (room, furniture, light and characters) in one art style. The reference is the character image I'm attaching, and the movie Entergalactic is the best comparison for the overall look. Use them for style only: don't copy any character, outfit or frame from either.

## The art style

The whole studio should look like a frame from a painted animated film, not a 3D render:

- Painted surfaces: soft colour bands instead of realistic shading, visible brush texture, flat but rich colour areas.
- Saturated, graphic colour: deep violet and blue shadows, warm amber lamp light, and pops of pink, red and cyan neon from the city.
- Clean, slightly stylized shapes with confident silhouettes, and thin dark outlines on the characters.
- A lived-in New York apartment that feels cosy, artsy and warm, never empty or showroom-like.

## Where it stands (branch `studio-look`, off `room-agent-tools`, not committed)

Claude in Cowork made a first pass. tsc and eslint pass. It was only checked in a small test harness, not in the real app yet:

- `scene/Painterly.tsx`: a post-processing effect that makes the whole frame look painted. It uses a Kuwahara filter (for each pixel it keeps the average colour of the calmest nearby patch, so flat areas turn into smooth paint and edges stay sharp), plus a colour grade (more saturation, violet shadows, warm highlights). It's wired into the effects in `Scene.tsx` right after the depth-of-field. The grade is stronger at night and lighter by day, based on New York time. `?paint=0` turns it off.
- `characters/Character.tsx` and `characters/outfits.ts`:
  - **Shading:** toon materials with a soft 5-step light ramp, and thin dark outlines on the head and torso.
  - **Proportions:** bigger heads, a stronger jaw, heavy half-closed eyelids, thicker brows.
  - **Outfit types:** `kind` (hoodie, suit or gym) plus `hoodUp`, `baggy`, `graphic`, `shirt`, `tie`, `tights` and `headband`.
  - **Office (emile):** navy suit, white shirt, red tie, brown loafers.
  - **Kitchen (chef):** white oversized hoodie with the hood up, a bold red chest print, baggy grey sweatpants.
  - **Bedroom (sleep):** grey hoodie with the hood up, baggy charcoal sweatpants.
  - **Gym (coach):** navy tee, black shorts over tights, a blue headband, white trainers.
- `look/textures.ts`: a new `brick()` canvas texture: old red-brown New York brick, sooty mortar, worn whitewash patches.
- `scene/Room.tsx`:
  - The left wall is now brick.
  - Brick above the windows, and brick piers at both ends of the window wall.
  - Black steel factory-window grid.
  - A bigger gallery wall, and warm string lights along the brick.

Look at this first pass, keep what works and redo what doesn't.

## What I want

**1. A compact, cosy studio.** Today's room is too big and empty (18 x 12 m, mostly open floor). Make it a real Manhattan studio of about 8 x 10 m, with these four corners close together and the room feeling full:

- **Bedroom corner:** a low bed with rumpled linen, a chunky knit throw, framed prints above it, a bookshelf as a divider.
- **Office corner:** a wooden desk by the window, a monitor and laptop, a vintage desk lamp, a pinboard.
- **Kitchen corner:** a small galley with open wooden shelves, subway tiles, a moka pot, a fruit bowl, a little bistro table.
- **Gym corner:** a bench, a dumbbell rack, a pull-up bar in a door frame, a yoga mat, a mirror leaning on the brick.

**2. The shell.**

- Exposed brick on the walls.
- Big black steel factory windows, with a fire escape outside and the city behind.
- Worn wide-plank floor, a cast-iron radiator.

**3. The details that make it a home:**

- Posters and a gallery wall.
- Lots of plants: monstera, trailing pothos, a few small ones.
- A record player and vinyl.
- Rugs, a leather armchair.
- Stacks of books, ceramics, a guitar or an easel.
- Candles, string lights.

Update `zones.ts` (anchors, camera poses) to fit the smaller room.

**4. Light that follows the time in New York.** `Daylight.tsx` and `ambient.ts` already follow New York time (`?hour=` overrides it). Push it further:

- **Around noon:** bright and airy, sunlight through the factory windows, lamps mostly off.
- **Around 5 pm:** golden hour, warm low sun, the first lamps turning on.
- **After dark:** violet-blue night outside, amber lamps, string lights and candles on, neon glow from the city.

Interior lamps, the window light and the painterly grade should all change together.

**5. Characters in the reference style.**

- Painted, stylized and expressive, with relaxed, confident poses.
- Each one dressed for their room as listed above.
- Push the faces and proportions further toward the reference: bigger hands, a clearer face, layered streetwear with bold graphic colour.
- Give them small life: walking a few steps, shifting weight, turning their head.

**6. Performance.**

- It has to run smoothly on my MacBook Air: aim for 50+ fps with the painted effect on (measure with `?stats=1`).
- If the painted effect is too heavy at full resolution, run it at lower resolution or only on high quality.
- Keep the earlier speed work: combined static meshes, few lights that cast shadows, shaders prepared behind the loading screen.

## Rules

- Use plan mode first and show me the plan before building.
- Before and after screenshots of the overview and each room at `?hour=12`, `?hour=17` and `?hour=22`.
- Don't touch the room pages, the agents or the data. This is only the 3D studio.
- Commit only when I say so. Plain wording, no em dashes.
