# Penthouse: a personal dashboard run with Claude

Emile Moyson, IENYC "Be a Master in Claude". Repo: github.com/emilemoyson/penthouse (private). Live: penthouse-ashen.vercel.app (password protected, so the repo has a demo seed instead).

## The problem

Food, money, training and school admin live in separate apps: Lidl receipts, MyFitnessPal, an Apple Notes gym note, Gmail and Outlook, two calendars. Nothing connects them, so everyday decisions (what to cook with what is in the fridge, whether the week's food spend is on track, what is due on Friday) are made blind. The goal is one private place where the data arrives on its own and Claude can answer questions about it.

## The approach

A Next.js and Postgres dashboard whose home page is a 3D apartment: the kitchen, gym, desk and bed each open a panel. Data comes in through one authenticated endpoint, `POST /api/ingest/:kind`, from small scripts and scheduled tasks. Claude does the parts that need judgment: reading messy input, answering questions, checking the code.

## How Claude is used

| Where | What Claude does | Files |
| --- | --- | --- |
| Messages API | Reads receipt photos and typed lists with structured output; guesses package sizes and macros; the kitchen chat streams, calls tools that only propose a cook, meal or size fix, and saves only when the user presses Save | `src/lib/receipt.ts`, `src/lib/groceries.ts`, `src/app/api/kitchen/chat/route.ts` |
| Own MCP server | Pantry, meals, spend, workouts, "what can I cook", a weekly review prompt, sampling, progress notifications, roots. Reads go through a read-only Postgres role, writes only through the ingest API. A receipt import cuts card data before anything leaves the Mac | `mcp/` |
| Skills | `verify` (the full gate), `weekly-food-report`, `new-ingest-kind` | `.claude/skills/` |
| Subagents | `verifier` and `code-reviewer` (read-only, a cold second opinion), `nutrition-analyst`, `gym-data-parser` | `.claude/agents/` |
| Hooks | Block reading `.env` files, a type check gate when a session stops, read-only Bash for the reviewers | `.claude/hooks/` |
| Headless and scheduled | `claude -p` with a JSON schema and a budget cap parses the gym note every 30 minutes; an hourly task reads Gmail and Outlook, adds calendar events and sends to-dos to the ingest API | `scripts/gym_sync.py`, `automation/calendar-agent.md` |

## How I checked it

- 19 vitest tests (unit tests for the cooking math and the strength estimate, 5 integration tests for the ingest API: auth, validation, idempotent re-sends) and 20 pytest tests for the MCP server.
- `verify.sh` runs the type check, build, tests and a smoke test on a copy of the database, and then checks that the real database was not touched.
- GitHub Actions runs the same on every pull request, with a Postgres service, and fails if the receipt eval numbers change without being committed.
- Two evals, results in `evals/results.md`:
  - Receipt parser (8 made-up receipts, 19 items): recall and precision 94.7%, price, quantity, unit and date match 100%, 0 card details left in the payload, and the one unrecognised layout went to the Claude fallback.
  - Gym note parser (my real 124 line note, 18 hand-counted checks, 3 runs): 18 of 18 in every run, and an empty answer scores 0 of 18, which checks the scorer.
- The evals found two real bugs. A payment block starting with a card brand (`VISA ****9999`) was not cut, so card digits would have stayed in the text. Weight and count lines without a `$` were ignored, so a 1.6 lb item counted as one item. Both are fixed and covered by cases.

## Limits

- The receipt cases are made up by me in the layouts the app handles, so the numbers show the parser does what I designed it to do, not how it does on every real receipt. A wrapped item name still fails (recall 94.7%).
- The Claude paths (receipt photos, size guessing, the kitchen chat) are not evaluated yet. That needs receipt screenshots and API spend.
- The gym eval is one note. It is a regression test, not a measure of the parser on any note. I loosened four name checks after seeing the output, so those are not fully blind.
- Some checks (skill and subagent triggers) were run by hand. One code-reviewer trigger failed at first and needed a better description.
- The MCP HTTP transport is not deployed. There is no plugin package, and no Claude review step in CI; both were cut for time.
- A known gap in the Bash guard: reading a secret file with `git diff --no-index` is not blocked.
- The 3D scene is procedural (no model files), so it is stylised rather than realistic.

## Demo script (about 4 minutes)

1. **0:00 Home (20 s).** The apartment at night, click the kitchen. Say what the project is in one sentence.
2. **0:20 Kitchen (60 s).** Fridge panel with spend. In the chat, type "I made 4 portions of chicken and rice and ate one". Show the proposal card, press Save, show the fridge going down and the meal appearing.
3. **1:20 MCP (50 s).** In Claude Code in the repo: "what can I cook with what I have?" then "run the weekly review". Point out the read-only role.
4. **2:10 Gym (30 s).** Gym panel from the Apple Notes note, then `python3 evals/gym/score.py --selftest`.
5. **2:40 Office (20 s).** To-dos and calendar filled by the hourly email task.
6. **3:00 Rigor (50 s).** Terminal: `bash .claude/skills/verify/verify.sh` (show the last lines), the green CI run, `evals/results.md`. Say the two bugs the eval found.
7. **3:50 Limits (15 s).** What is not evaluated yet and why.
