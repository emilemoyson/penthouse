# Panel data

- `server.ts` loads each panel (DB). Each payload has `source`: live, partial or sample, and falls back to labelled samples from `samples.ts` when there's no data. `hooks.ts` refreshes via `GET /api/penthouse/:zone` (sleep, professional, fitness, nutrition).
- `actions.ts` holds the server actions; each returns the refreshed panel data.
- `POST /api/ingest/:kind` (`src/app/api/ingest/[kind]/route.ts`): sleep, meals, groceries, emails, events, todos, workout-text, gym-note. Bearer `INGEST_TOKEN`, zod-validated, idempotent upserts. Examples in README.

## Gym

Main path: the Apple Notes "gym" note, read by `scripts/gym_sync.py` and parsed by the `gym-data-parser` agent, into `/api/ingest/gym-note`. Those workouts are `source = 'note'` with `note_seq` (the nth session of that split); a known (kind, note_seq) keeps its date and gets its sets replaced, a new one is dated the note's last-edited day. The first sync adopts the seed import ("Imported from your notes...") as sessions 1..n. Emile's real dates for those (2026-10-20): Push on Mondays Sep 21 to Oct 12, Pull on Wednesdays Sep 30 to Oct 14.

Older path: `src/lib/parse-workout.ts` reads the `docs/gym-template.md` format. Shortcut imports are `workouts.source = 'shortcut'` and are replaced per (date, kind) on re-send. Not connected yet: the iPhone Shortcut needs the deployed URL.

## Kitchen: shop → fridge → cook → meal

- `grocery_runs` and `pantry_items`: amounts in g, ml, item or serving; macros per 100 g/ml or per item/serving; `price` is for `qty_start`. Shared math in `src/lib/kitchen.ts` (client-safe).
- `src/lib/groceries.ts` saves a shop and fills missing macros: Open Food Facts by barcode first (only when the package size is known), then one Claude call.
- `src/lib/receipt.ts`: `claude-opus-5-5`, structured output (`betaZodOutputFormat`), effort medium, server-side fallbacks. The panel shrinks photos to about 1800 px JPEG first (`next.config.ts` allows 6 MB bodies).
- Package sizes: Lidl prints no size for packaged items (`GROUND BEEF 7.99 F`), so Claude works it out from the store and price (the store name is passed to `estimateItems`). Those items get `pantry_items.size_guessed`, shown as "check size" in the panel and "size guessed" on the kitchen page. `updatePantryItem(id, { size })` fixes it: `{ qty, unit }` sets the real package (what's left keeps its share; a count that becomes a weight gets macros per 100 g), `true` confirms the guess.
- Kitchen chat (`src/app/api/kitchen/chat/route.ts`): streams NDJSON. Claude matches plain-language cooking to fridge items and calls `propose_cook`, `propose_eat` or `propose_size_fix`, which only build cards. The card's Save button calls `cookMeal`, `eatItem` or `updatePantryItem`. The client keeps the API messages and sends them back (append-only, thinking blocks included); the current fridge goes into each new user message, never the system prompt. Saves are reported back as `[Saved] ...` at the start of the next message.
- `previewCook` in `src/lib/kitchen.ts` is the cook math (amounts capped at what's left, eaten share, leftovers per portion or per 100 g). `cookMeal` and the chat cards both use it. `cookMeal` also takes `extras` (oil and the like, not from the fridge) that add to the meal's macros.
- `cookMeal` takes a split: portions (made N, ate M) or weight (cooked dish g, ate g). The eaten share becomes a meal; the rest a leftovers item (unit serving, or g with macros per 100 g of the dish) in the fridge (4 days) or freezer (90). `eatItem` goes through `cookMeal` too.
- Every cook is a `cooks` row with `cook_uses`; `meals.cook_id` links back. `deleteMeal` undoes the cook (ingredients back, leftovers removed) only while the leftovers are untouched; otherwise it deletes just the meal. Meals before 2026-10-20 have no cook row.
- `updatePantryItem` with a qty above `qty_start` raises `qty_start` (fixes a wrong package size).
- `meals.cost` and `meals.kind` (home | out) drive the spending numbers. MyFitnessPal days (`source = 'mfp'`) hide manual rows.
- UI: panel `src/penthouse/overlays/kitchen.tsx`, full page `src/app/(app)/kitchen`.
