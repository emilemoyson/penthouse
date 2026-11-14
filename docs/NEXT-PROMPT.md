# Next round: submission first, then the studio redesign, the new pages and the WhatsApp agent

You're working on my personal dashboard (repo: this folder, live at penthouse-ashen.vercel.app). Read CLAUDE.md, docs/STATUS.md and docs/ROADMAP.md first.

Where things stand: item 1 (MCP server) and item 2 (skills) are committed and pushed. Item 3 (subagents) is in progress on branch `subagents`: verifier.md, code-reviewer.md, nutrition-analyst.md and hooks/readonly-bash.mjs are untracked, and CLAUDE.md and weekly-food-report/SKILL.md have changes. The live site still runs the Oct 20 deploy (758c4ec); nothing since has been merged or deployed. The 3D WIP is on `kitchen-sample` (a18cc71).

The Master in Claude project is due **Sunday Nov 15** (moved from Nov 12). I hand in a 2-3 page write-up, the GitHub repo and a 3-5 minute demo video. Grading: business relevance, depth of Claude usage (skills, agents, MCP, API), rigor (validation, verification, honest limits), documentation and demo.

So work in this order. Phase 1 is not optional and comes first. Use plan mode for each phase and show me the plan before building. One phase or sub-item per session (/clear in between), update STATUS.md at the end of each.

---

## Phase 1: ship the submission (by Sunday night)

1. **Finish item 3 (subagents).** Review the untracked files, finish them, check each one triggers (like docs/skills-triggers.md), commit on `subagents`.
2. **Item 4, the minimum that proves rigor:**
   - Receipt eval: the Lidl receipts I have (cut before the payment block, card data never leaves the Mac), hand-labelled ground truth, a script that scores item recall, qty error, price match and size_guessed, results in evals/results.md with honest numbers.
   - gym-data-parser eval against my gym note.
   - Integration tests for /api/ingest and unit tests for previewCook and e1rm, added to verify.sh.
   - GitHub Actions: tsc + build + tests on PRs.
3. **Item 5:** package skills, agents, hooks and the MCP config as a plugin (`plugin/`), and write docs/MASTER-IN-CLAUDE.md: a table mapping each of the 10 DataCamp courses to the files that show it, plus known limits.
4. **Real data for the MCP server:** apply mcp/sql/readonly_role.sql to Neon (ask me before touching production) so the MCP server and weekly-food-report run on my real data, not hub_test.
5. **Merge and deploy** to Vercel once verify passes, so the demo runs on the live site. Ask me before merging to main.
6. **Office quick fixes** (they show in the demo):
   - Remove the Jobs tab and every job goal from the dashboard ("Applied this week 0/10", In progress, To apply, response rate, and anything on Habits that uses the weekly application target). Leave the Job Search sheet, the JobsFeed script and my "Job search review" scheduled task alone.
   - The to-do list says "Nothing to do from your inbox" because the email task was posting to localhost. I've already fixed the task: it now runs hourly from 7:07 to 23:07 New York time, reads the last 3 days of Gmail (skipping threads labelled Penthouse/Processed) and posts to the Vercel URL. Update automation/calendar-agent.md to match the new prompt (I'll paste it in; keep the token as a placeholder). Then check the to-dos actually arrive. If the task's token gets a 401, tell me how to put the right one in.
7. **Write-up draft** (docs/WRITEUP.md, 2-3 pages): the problem (personal operations: food, money, training and school admin are scattered across apps, so decisions are made blind), the approach, how Claude is used (API, MCP, skills, subagents, hooks, headless runs, scheduled tasks), results from the evals, limits. Plus a 3-5 minute demo script with shot list.

Stop after Phase 1 and tell me what's done. I submit, then we continue.

---

## Phase 2: the studio redesign (3D + UI)

### 2a. The space: a cosy Manhattan studio, not a penthouse

Make it smaller, warmer and more artsy, like a real walk-up studio someone has lived in for years.

- **Shell:** one compact room (about 7 x 9 m) with exposed red brick walls (real brick texture with mortar depth, a bit uneven), one plaster wall, tall black steel factory windows with a fire escape outside and the city at dusk or night behind it, wide-plank worn oak floor, a cast-iron radiator under the window.
- **Light:** warm and layered, never flat. Edison bulb pendants, a brass floor lamp, a small desk lamp, string lights along the brick, candles, light from the street through the window. Each corner gets its own pool of light so the room reads at a glance.
- **Bedroom corner:** low bed with rumpled linen and a chunky knit throw, a bookshelf as a divider, framed prints above the bed.
- **Kitchen corner:** small galley with open wooden shelves, white subway tiles, a moka pot, a fruit bowl, a small round bistro table with two chairs.
- **Office corner:** wooden desk by the window, monitor plus laptop, a vintage task lamp, a pinboard with notes.
- **Gym corner:** bench, dumbbell rack, a pull-up bar in a door frame, a yoga mat, a mirror leaning against the brick.
- **Artsy details:** gallery wall of mixed frames and posters, a record player with a vinyl shelf, stacks of books, trailing pothos and a big monstera, a kilim or Persian rug, a leather armchair, ceramics, a guitar or an easel.
- Everything stays procedural and fast. Keep the speed gains from `kitchen-sample` (batching, no shadowed point lights, warmup, curtain) and measure with `?stats=1` before and after. Target 50+ fps on my MacBook Air.

### 2b. Characters

They look too fake. Build a `/lab/characters` page that shows the same four characters in 3 or 4 style options side by side, so I can pick one:

- **A. Soft clay:** smooth, matte, slightly chunky, simple dot-eye faces. Cosy and fits the brick.
- **B. Low-poly:** faceted, flat-shaded, a small colour palette. Crisp and very fast.
- **C. Realistic proportions:** rigged GLB models from a free CC0 pack with real walk and idle animations. Least fake, heaviest.
- **D. Editorial mannequins:** faceless, one skin tone, tall fashion-illustration proportions, so the clothes do the talking.

Outfits per room, whichever style wins:

- **Kitchen and home:** grey sweatpants, an oversized hoodie with the hood up, socks and slides.
- **Office:** a tailored charcoal or navy suit, white shirt, loafers.
- **Gym:** shorts over tights, a fitted training tee, trainers, headphones round the neck.
- **Bedroom:** soft loungewear.

They should move around a bit, not just loop in place.

### 2c. Motion: one steady move, then straight to the page

- **Fix the camera.** Clicking a room should not zoom out before zooming in. Interpolate straight from the current pose to the room pose in one eased move: position and look-at together, about 700-900 ms, no waypoint through the overview. Find out why it dips today (probably the Bezier control points in CameraRig) and say what it was.
- **No side panel any more.** Clicking a room goes straight to that room's full page. Keep the rise into the night sky as the transition (the camera rises, the page slides up), but trigger it automatically after the camera arrives. Esc, a back button or scrolling up at the top returns to the studio.
- **While a page is open,** pause or unmount the 3D canvas so the page itself scrolls smoothly.
- **Smoothness everywhere:** prefetch the room routes, use skeletons instead of blank loads, add consistent 150-200 ms transitions on tabs and cards, and use native smooth scrolling with no scroll-jacking except the rise transition. Respect reduced motion.

### 2d. Pages that look like a real product

All four room pages share one design system: a top bar with room switcher and the studio button, then sub-tabs, then a card grid that fits on one screen at 1440x900 without long scrolling. Clean type, consistent spacing, light and dark. Use shadcn/ui-style components on the existing Tailwind setup.

**Office**
- **Calendar tab:** a proper week view (like Google or Apple Calendar) with a month toggle, colours from the `#kind` tags, today highlighted, click an event for details plus its email link.
- **To-dos tab:** grouped Overdue / Today / This week / No date, a source chip (Gmail, Outlook, Blackboard, WhatsApp), tick to complete, add by hand, an "Open email" link.
- **Inbox tab:** the email summaries.
- No Jobs tab.

**Kitchen**
- **Fridge tab:** everything visible at once, as a compact grid or table grouped by fridge, freezer and pantry, with use-soon chips, "check size" flags and a search box. No scrolling to find things.
- **Today tab:** meals logged, macros vs targets, and one-tap buttons for my usual meals.
- **Meals tab:** saved meals and meal preps. Add a `saved_meals` table (name, ingredients from the fridge, portions, macros per portion). Seed it with my everyday breakfast, "4 eggs + avocado toast", and a poke bowl meal prep (I'll paste the recipe from my Claude chat). Logging a saved meal takes the ingredients out of the fridge. Meal preps track portions left.
- **Recommended:** meals I can make from what's in the fridge. Portions should be decently big with plenty of protein. When suggesting groceries, pick the clearly healthier option even if it costs a bit more; if two are about the same nutrition-wise, pick the cheaper one.
- **Budget tab:** spend this week and month, groceries vs eating out, cost per meal home vs out, protein per dollar, price history per item.
- **Chat:** the existing kitchen chat, now also able to suggest meals and log saved meals.

**Gym**
- **Overview tab:** this week vs target, streak, last session, a suggested next session.
- **Lifts tab:** per-exercise progress with estimated 1-rep max charts and status.
- **Volume tab:** sets per muscle per week.
- **History tab:** a session table.
- **Ask tab:** a chat over my training data through the MCP tools.
- Compact, tabs instead of one long page.

**Bedroom**
- Keep it honest: if sleep is still sample data, say so clearly.
- Plan a nightly iPhone Shortcut that reads sleep from Apple Health and posts to /api/ingest/sleep, and give me the setup steps.

### 2e. Connections page

Add a Settings > Connections page with one row per source (Google Calendar, Jobs sheet, Gmail task, Outlook, Lidl, gym note, WhatsApp): status, last sync, last error, and a "test" button. Make Google Calendar and Sheets easier to connect: look at moving from the secret iCal URL to Google OAuth (Calendar + Sheets APIs) so the dashboard can also add events. Tell me the trade-offs before building it.

### 2f. Rename

"Penthouse" no longer fits. Put the site name in one constant so it's a one-line change. I'll pick from: Walk-up, Apt 4B, Hearth, The Studio, Home Base.

---

## Phase 3: my WhatsApp agent

I have a new US number with a WhatsApp Business account. I want to text an agent and have it change my dashboard. Kitchen matters most: "had a Chipotle bowl, extra chicken for dinner", or a photo of my food or a receipt.

- **Channel:** Meta WhatsApp Cloud API. Webhook at /api/whatsapp on Vercel: GET for the verify handshake, POST for messages. Check the X-Hub-Signature-256 signature with the app secret. Only accept messages from my number (env allowlist). Store every message in a `messages` table.
  - First, check whether my number can use the Cloud API while it's also on the WhatsApp Business app (Meta has a "coexistence" onboarding for this), or whether I need Meta's test number or a second number. Tell me before I change anything on my phone.
  - Env vars: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN, WHATSAPP_ALLOWED_NUMBER. Never in git.
- **The agent:** build it with the Claude Agent SDK (or a tool-use loop on the Messages API if the SDK doesn't fit Vercel functions; tell me which and why). Its tools reuse what exists:
  - log_meal: text or photo via vision, kind out or home, estimated macros and cost, flagged as estimated
  - log_saved_meal ("usual breakfast")
  - eat_meal_prep ("had a poke bowl")
  - add_groceries (receipt photo)
  - log_workout_text (gym note format)
  - add_todo, complete_todo
  - questions like "how much protein do I have left today?" or "what's in my fridge?" through the MCP server's read tools
- **Replies:** every write answers with one line, e.g. "Logged dinner: chicken bowl, about 850 kcal, 48 g protein, $14.20. Reply 'undo' or 'fix ...'". Undo and fix must work. Unclear messages get one short question back.
- **Dispatch for laptop-only jobs:** anything that needs my Mac (editing the Apple Notes gym note, running a Claude Code task) goes into an `agent_jobs` queue table. A small launchd worker on my Mac picks jobs up when the laptop is awake, runs them with headless `claude -p` (allowed tools only, cost cap, like gym_sync.py), writes the result back, and the agent tells me on WhatsApp it's done.
- **Proactive messages:** WhatsApp only allows free text within 24 hours of my last message; outside that it needs approved templates. Plan one template for a morning brief and a "meal not logged by 9 pm" nudge, but build those last.
- **Eval:** 10 takeout meals from chains that publish nutrition. Score the estimates and add them to evals/results.md.
- **Live update:** the kitchen page refreshes on its own when a WhatsApp log lands (polling or server-sent events is fine).

---

## Rules (all phases)

- Plan mode first; show me the plan. Branch per item. Commit, merge and deploy only when I say so.
- Test on hub_test, never the real DB. Never print or commit .env.local, scripts/.env or any token. Ask before touching Neon or Vercel settings.
- Use subagents where they help: the verifier after each item, code-reviewer before each commit. Use git worktrees if you split the redesign into parallel tracks (3D, pages, WhatsApp).
- Take before and after screenshots of every room and page in the redesign.
- Plain, understated wording in the UI and docs. No em dashes. They/them for me.
