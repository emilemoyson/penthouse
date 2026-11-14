# Roadmap: IENYC "Be a Master in Claude"

Deadline: Sun Nov 15 (moved from Thu Nov 12). Deliverables: a 2 to 3 page write-up, this GitHub repo, and a 3 to 5 minute demo video. A classmate has to be able to reproduce it.

Grading: 50% project, 50% test. The project is judged on:
1. Business relevance
2. Depth of Claude usage: skills, agents, MCP, API
3. Rigor: validation, verification, honest limits
4. Documentation and demo

## Already in place

- 4 CLAUDE.md files (root, `src/penthouse/`, `src/penthouse/data/`, `scripts/`)
- Hooks in `.claude/hooks/`: guard-bash, guard-edit, after-edit, on-stop tsc gate, notify
- Permissions in `.claude/settings.json`
- The `gym-data-parser` subagent, run headless with `--json-schema`
- The hourly email routine (`automation/calendar-agent.md`)
- Anthropic API in `src/lib/receipt.ts` (structured output) and the kitchen chat (tool use and streaming)

## Focus

The Kitchen is the showcase room: receipt → Claude → fridge → chat → meals → spending. Go deep there first, Gym second. Don't touch the 3D scene.

## How we work

- One item per session, `/clear` in between.
- Plan mode first for each item; Emile sees the plan before building.
- Branch per item, commit only when Emile says so.
- Test against `hub_test`, never the real DB. Never print or commit `.env.local` or `scripts/.env`.
- Update `docs/STATUS.md` when an item is done.
- Plain wording, no em dashes.

## The 5 items

### 1. Own MCP server (`mcp/penthouse_mcp`, Python, FastMCP)

- Tools: `get_pantry`, `get_meals(from, to)`, `get_spend(from, to)`, `get_workouts(from, to)`, `what_can_i_cook`.
- Resources: `penthouse://pantry`, `penthouse://meals/{date}`. One prompt: `weekly-review`.
- Reads use a read-only Postgres role. Any write goes through `/api/ingest` with the bearer token, never straight to the DB.
- Advanced features from the DataCamp MCP course, each for a real reason:
  - Sampling: `what_can_i_cook` and a weekly summary ask the client's model to write the text.
  - Progress and log notifications: `import_receipts(folder)` reports progress per receipt.
  - Roots: `import_receipts` only reads files inside the client's roots.
- Both transports: STDIO for Claude Code and Desktop (registered in `.mcp.json`), StreamableHTTP behind a bearer token. Deploy HTTP only if it's simple.
- README section: how to run it, plus 3 example conversations.

### 2. Skills (`.claude/skills/`)

- `weekly-food-report`: pulls a week through the MCP server and writes the analysis: spend vs budget, protein per dollar, cost per meal home vs out, items that went past use-by (waste), one recommendation.
- `verify`: tsc, build, tests, then a test on the `hub_test` copy.
- `new-ingest-kind`: adds a new `/api/ingest` kind end to end (zod schema, table, panel, README example).
- Each SKILL.md tight, progressive disclosure, tools restricted where it makes sense. For each skill, 2 prompts that should trigger it and 1 that shouldn't, checked.

### 3. Subagents (`.claude/agents/`)

- `verifier`: read-only, runs checks and gives a cold second opinion on a finished change. Never fixes anything.
- `code-reviewer`: reviews the diff before a commit.
- `nutrition-analyst`: used by `weekly-food-report` for the numbers.
- Each with a clear "when to use" description, minimal tools, and a model choice with a reason.

### 4. Tests, evals and CI

- Receipt eval (`evals/receipts/`): 10 real Lidl receipts, cut before the payment block (card data never leaves the Mac), each with a hand-labelled ground-truth JSON. A script scores item recall and precision, qty error, price match and `size_guessed` accuracy, and writes `evals/results.md` with honest numbers.
- Same for `gym-data-parser` against the gym note.
- Integration tests for `/api/ingest` (auth, validation, idempotent re-sends) and unit tests for `previewCook` and `e1rm`.
- GitHub Actions: tsc, build and tests on every PR, plus Claude code review on PRs. Secrets only via GitHub secrets.

### 5. Plugin and docs

- Package the skills, agents, hooks and MCP config as a Claude Code plugin (`plugin/`) so a classmate can install it.
- `docs/MASTER-IN-CLAUDE.md`: a table mapping each of the 10 DataCamp courses to the files in this repo that show it, plus known limits.

## Progress

| # | Item | Branch | State |
| --- | --- | --- | --- |
| 1 | MCP server | `mcp-server` | done, committed 2026-11-13 |
| 2 | Skills | `skills` | done, not committed yet (2026-11-13) |
| 3 | Subagents | | |
| 4 | Tests, evals, CI | | |
| 5 | Plugin and docs | | |
