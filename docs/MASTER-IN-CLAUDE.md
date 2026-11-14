# Master in Claude: where each skill shows up in this repo

The table is by topic. The 10 DataCamp course names are not written down anywhere in the repo, so the first column is the topic and the course name can be added next to it (marked TODO) before hand-in.

| Topic (course) | Where it shows | What to look at | Limit |
| --- | --- | --- | --- |
| Project memory: CLAUDE.md (TODO course name) | `CLAUDE.md`, `src/penthouse/CLAUDE.md`, `src/penthouse/data/CLAUDE.md`, `scripts/CLAUDE.md` | Rules, map and gotchas per folder, so a fresh session starts informed | Hand-written, so it can go stale; STATUS.md is updated by hand |
| MCP server (MCP course) | `mcp/penthouse_mcp/`, `.mcp.json`, `mcp/README.md` | Tools, resources, a prompt, sampling, progress and log notifications, roots, STDIO plus HTTP. Reads use a read-only Postgres role (`mcp/sql/readonly_role.sql`); writes go through `/api/ingest` | HTTP transport not deployed; tests run on `hub_test` or a CI database, not on the real data |
| Skills (TODO) | `.claude/skills/{verify,weekly-food-report,new-ingest-kind}`, `docs/skills-triggers.md` | Each skill has trigger and non-trigger prompts that were checked | Trigger checks were run by hand, not on a schedule |
| Subagents (TODO) | `.claude/agents/{verifier,code-reviewer,nutrition-analyst,gym-data-parser}.md`, `docs/agents-triggers.md` | Read-only reviewers with minimal tools; the gym parser runs headless with a JSON schema | One code-reviewer trigger prompt needed a rewrite of its description to fire (recorded in the doc) |
| Hooks (TODO) | `.claude/hooks/`, `.claude/settings.json` | Secret guard on Bash and Edit, tsc gate on stop, read-only bash for the reviewers | The `git diff --no-index` form of reading a secret file is a known gap in `guard-bash.mjs` |
| Claude API (TODO) | `src/lib/receipt.ts`, `src/lib/groceries.ts`, `src/app/api/kitchen/chat/route.ts` | Structured output for receipts, tool use and streaming in the kitchen chat, prompts that carry the fridge | Photo reading is not evaluated yet (no receipt screenshots, API spend) |
| Headless and scheduled runs (TODO) | `scripts/gym_sync.py`, `automation/calendar-agent.md`, launchd plists in `scripts/` | `claude -p` with a schema and a budget cap; the hourly Gmail and Outlook task posts to the ingest API | The email task is device-bound; its title in the desktop app is stale |
| Tests (TODO) | `tests/`, `mcp/tests/`, `vitest.config.ts`, `.claude/skills/verify/verify.sh` | 19 vitest tests (5 integration against `hub_test`), 20 pytest tests, a verify script that also checks the real database is untouched | Integration tests need a running server and a token, so they are skipped without both |
| Evals (TODO) | `evals/`, `evals/results.md` | Receipt parser (8 cases, free, in CI) and gym note parser (18 checks, 3 runs), with a negative control for the scorer | Receipt cases are made up in the layouts the app handles; the gym note is one real note |
| CI (TODO) | `.github/workflows/ci.yml` | Postgres service, tsc, vitest, build, ingest integration, MCP tests, receipt eval with a diff check | No Claude review in CI (cut for time) |
| Plugin (TODO) | `plugin/` | Not built | Cut: packaging only, nothing new to learn from it |

## How to reproduce

See "Try it without my data" in the README. `npm test`, `python3 evals/receipts/score.py` and `python3 evals/gym/score.py --selftest` need no keys.
