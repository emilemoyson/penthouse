# The Office: my day as an apartment, run with Claude

Emile Moyson, IENYC "Be a Master in Claude", November 2026.

- Repo: github.com/emilemoyson/penthouse (branch `main` is the personal Office, `office-multiuser` the general one)
- Personal Office: penthouse-ashen.vercel.app (password: `emilemoyson`)
- General Office: the-office-moyson.vercel.app (sign in with Google)

**Where to look first.** The personal Office is where everything lives: all four rooms, the room chats, the hourly email task, the iPhone Shortcut, the receipt sync and every Claude Code piece (MCP server, skills, agents, hooks). The general version shows the same idea opened up to other people, but it has fewer rooms filled in. If you have time for one, open the personal one.

## 1. The problem

Food, money, training and school live in separate apps: Lidl receipts, a gym note on my iPhone, Gmail and my school Outlook, two calendars, Blackboard. Nothing connects them, so everyday decisions (what to cook from what is in the fridge, whether I'm eating enough protein for my training, what is due this week) are made blind. Typing everything into one more app doesn't work either, because I stop after a week.

The idea: one place that fills itself from things I already do, and where Claude does the parts that need judgment, like reading a messy note or a receipt photo.

**Business angle.** The same problem applies to most students and busy professionals. So there are two editions: my own Office, and a general product anyone can sign up for, with their data kept apart from everyone else's.

## 2. What I built

**Personal Office (Next.js, Neon Postgres, Vercel).** The home page is a 3D apartment drawn entirely in code with React Three Fiber. It has four rooms:

- **Desk:** calendar (Google, plus my Blackboard class calendar) and to-dos. An hourly scheduled Claude task reads Gmail and Outlook, adds plans to Google Calendar and sends to-dos to the Office.
- **Gym:** I log workouts in iPhone Notes. A Shortcut sends the note to my ingest API, and Claude turns it into exercises, sets, reps and weights.
- **Kitchen:** a Python script picks up Lidl receipts; paper receipts are read from a photo by Claude. The kitchen tracks the fridge, protein and cost per meal.
- **Bedroom:** sleep, logged by typing a sentence into the bedroom chat.

Every room has its own chat (Anthropic API). It only sees that room's data and proposes changes as a card that I confirm before anything is saved.

All data arrives through one endpoint, `POST /api/ingest/:kind`, protected by a private key, so a phone, a script or a Claude task can all feed the same Office.

**General Office (same code base, Supabase).** Google sign-in, and row level security in the database, so each person can only read their own rows. A Connectors page replaces my personal scripts:

- **Connect Google:** reads the last 14 days of email with Claude and pulls out to-dos, plans (added to Google Calendar) and grocery orders (into the fridge). Email bodies are never stored, only what was found.
- **Workout sheet:** picked with Google's own file picker (`drive.file`), so the app only sees that one file.
- **iPhone Shortcut** with a personal key, and **receipt photos** from the phone.
- **Ask for a connector:** a request opens a GitHub issue for me.
- Users can delete their account and all their data in one step.

## 3. How Claude is used, by course

| Course | Where it shows | Files |
| --- | --- | --- |
| Claude 101 | Prompt framework in every system prompt; scheduled task in the desktop app; connectors (Gmail, Calendar) | `automation/calendar-agent.md` |
| Analyzing Data with Claude | Weekly food report: spend, protein per dollar, waste, cost per meal; gym progress charts | `.claude/skills/weekly-food-report`, `.claude/agents/nutrition-analyst.md` |
| Building Claude Cowork Plugins | Not built. Packaging only, cut for time | |
| Claude Code 101 | Explore, plan, code, commit; plan mode for the connectors; CLAUDE.md per folder; MCP to the database; hooks | `CLAUDE.md`, `src/penthouse/CLAUDE.md`, `scripts/CLAUDE.md` |
| Introduction to Agent Skills | `verify`, `weekly-food-report`, `new-ingest-kind`, each with trigger and non-trigger prompts checked | `.claude/skills/`, `docs/skills-triggers.md` |
| Introduction to Subagents | `verifier` and `code-reviewer` (read-only, a cold second opinion), `nutrition-analyst`, `gym-data-parser` | `.claude/agents/`, `docs/agents-triggers.md` |
| Claude Code in Action | Hooks that block reading secrets, a type check gate on stop; headless `claude -p` with a JSON schema and budget cap; worktrees for the two editions; GitHub Actions | `.claude/hooks/`, `scripts/gym_sync.py`, `.github/workflows/ci.yml` |
| Software Development with Claude Code | The ingest API built and validated with zod, integration tests on a throwaway database copy, code review before each commit | `src/app/api/ingest/[kind]`, `tests/` |
| Introduction to Claude Models | Messages API: structured output for receipts and email, tool use and streaming in the room chats, system prompts that carry the room's data | `src/lib/receipt.ts`, `src/app/api/kitchen/chat/route.ts` |
| MCP: Advanced Topics | Own MCP server: 7 tools, 2 resources, a prompt, sampling, progress and log notifications, roots, STDIO and HTTP; reads through a read-only Postgres role | `mcp/` |

A longer map with limits per topic is in `docs/MASTER-IN-CLAUDE.md`.

## 4. How I checked it

- **Tests:** 19 vitest tests (unit, plus 5 integration tests for the ingest API: auth, validation, repeated sends) and 20 pytest tests for the MCP server.
- **Verify skill:** `verify.sh` runs the type check, build, tests and a smoke test on a copy of the database, then checks the real database was not touched.
- **CI:** GitHub Actions runs the same on every pull request with a Postgres service.
- **Evals** (`evals/results.md`):
  - Receipt parser: 8 receipts, recall and precision 94.7%, 0 card details left.
  - Gym note parser: my real note, 18 of 18 checks in 3 runs, and an empty answer scores 0, which checks the scorer.
  - The evals found two real bugs (card digits not cut after `VISA ****`, weight lines without a `$` ignored). Both are fixed and covered.
- **Agents:** the `verifier` and `code-reviewer` agents check each change before it is committed.
- **Privacy:** in the general version, a second test account sees none of the first account's data. Claude never saves without a confirm card.

## 5. Weaknesses (general version)

- **Google access:** reading Gmail is a restricted permission. Until Google reviews the app, only people I add as test users can connect, and they see an "unverified app" warning.
- **Locked connectors:** Strava only gives API access to paying subscribers, and Apple Notes and Apple Health have no web access, so iPhone data needs a Shortcut. Every new connector needs its own developer app, a secure login and often a review.
- **No real users yet:** tested by me and test accounts only.

**Next:** Google's review, more connectors, and real users.

## 6. How to reproduce

- **Quickest:** open the personal Office with the password `emilemoyson`, or the general Office with a Google account.
- **Locally, without my data:** see "Try it without my data" in the README. Any empty Postgres, `npm install && npm run dev`, then `scripts/seed_demo.py` fills sleep, meals, to-dos and a gym session.
- **No keys needed:** `npm test`, `python3 evals/receipts/score.py`, `python3 evals/gym/score.py --selftest`.
