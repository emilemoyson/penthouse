# Context: the last day before the Master in Claude deadline

This is background for the session, not a task list. It says where the project stands, what matters for the grade, and what Emile wants the finished product to look like. Plan from it, check the plan with Emile, then build.

## The deadline and the grading

- The IENYC "Be a Master in Claude" project is due **Sunday Nov 15, end of day (New York)**. That's tomorrow night. It was moved from Nov 12.
- What gets handed in: a 2-3 page write-up, the GitHub repo and a 3-5 minute demo video. A classmate should be able to reproduce it.
- The ranking is 50% project and 50% test. The project is judged on business relevance, depth of Claude usage (skills, agents, MCP, API), rigor (validation, verification, honest limits), and documentation and demo.
- Chechu (the program director) said in his last check-in that a big part of the grade is how much of the 10 DataCamp courses actually shows up in the project, and how deep the project goes in each area. So the real question for every feature is: which course does this show, and is it visible in the repo and the demo?

## Where the project stands (as of Nov 14)

- **Live site:** penthouse-ashen.vercel.app. Production runs `main` at dd6e70e, deployed today: evals, CI, the write-up and the demo script are live.
- **Current branch:** `ui-redesign`, with uncommitted work: new `office/` and `bedroom/` pages, `src/lib/site.ts` (the site name constant), and changes to the layout, nav, ui and Penthouse.tsx files.
- **Already built and committed:**
  - **3D home:** four rooms (Office, Bedroom, Gym, Kitchen). It works but isn't smooth. It is not the focus for tomorrow.
  - **CLAUDE.md files:** the root one plus nested ones for the 3D home, panel data and scripts.
  - **Hooks:** guard-bash, guard-edit, after-edit (lint plus an em dash check), on-stop (type-check gate), notify, and readonly-bash for the read-only agents.
  - **Subagents:** gym-data-parser (runs headless from the gym note sync), verifier, code-reviewer, nutrition-analyst. Trigger checks are in docs/agents-triggers.md.
  - **Skills:** weekly-food-report, verify, new-ingest-kind. Trigger checks are in docs/skills-triggers.md.
  - **MCP server:** `mcp/`, in Python. 7 tools, 2 resources and a prompt. It uses sampling, progress and log notifications, and roots, over both STDIO and HTTP. Its read-only database role exists locally on hub_test only, not on Neon yet, so it doesn't see real data in production.
  - **Anthropic API:** receipt reading with structured output, and the kitchen chat with tool use and streaming.
  - **Evals:** the receipt parser and the gym note parser (`evals/`, results in evals/results.md).
  - **Tests and CI:** vitest unit and integration tests, plus GitHub Actions running tsc, tests, build and pytest.
  - **Docs:** docs/MASTER-IN-CLAUDE.md (the course-to-file map), the write-up, the demo script, and a demo seed script.
  - **Scheduled tasks:**
    - The hourly email task: Gmail, plus Outlook when the Mac is awake, goes to Google Calendar and to-dos. It now posts to the live site. Whether the to-dos actually arrive there is not confirmed yet.
    - A Lidl Plus receipt sync and an Apple Notes gym sync, both launchd jobs on the Mac.
- **Not built yet:**
  - A plugin package.
  - One agent per room.
  - A generic, empty version of the product.
  - The full-screen room pages.
- **Known loose ends:**
  - `guard-bash.mjs` can still be bypassed with `git diff --no-index /dev/null .env.local`.
  - `automation/.Rhistory` must not be committed.

## What the 10 DataCamp courses cover

Emile will log in to DataCamp in Chrome and give browser access, so the course pages can be checked directly. If that's slow, here is the outline of each course (taken from the public course pages), to map against the repo:

1. **Claude 101:** prompt framework; Chat, Cowork and Code modes; Projects; artifacts; Skills; connecting tools; enterprise search; Research mode.
2. **Analyzing Data with Claude:** answers from data files, cleaning messy data, formulas in plain language, combining sheets, pulling from a connected database, charts and simple dashboards, an end-to-end analysis.
3. **Building Claude Cowork Plugins:** installing a plugin, evaluating and customizing external plugins, building and sharing your own plugin.
4. **Claude Code 101:** the agentic loop, plan mode, explore → plan → code → commit, context management and compaction, subagent code review, CLAUDE.md, subagents, skills, MCP (connecting a database), hooks (enforcing formatting on every edit).
5. **Introduction to Agent Skills:** writing a SKILL.md, activation, configuration and multi-file skills, skills vs other features, sharing skills, wiring skills into subagents, fixing skills that don't trigger.
6. **Introduction to Subagents:** context isolation, built-in agents, creating custom subagents with /agents, design patterns, when to delegate and when to keep work on the main thread.
7. **Claude Code in Action:** steering long sessions (scoping, rewind, goals, parallel worktrees), a lean CLAUDE.md, verification skills, permission modes, hooks (unskippable rules, redacting instead of blocking), scheduled routines and headless mode, the Agent SDK, GitHub Actions and code review, verifying unsupervised runs, a cold second opinion, packaging as plugins.
8. **Software Development with Claude Code:** explore-plan-code, extended thinking, CLAUDE.md upkeep, custom agents, skills, safe refactoring with a test baseline, hooks, MCP to a database, building and validating an API endpoint, integration tests, a capstone CLI with plan mode, MCP, agents and a code-reviewer agent.
9. **Introduction to Claude Models:** the Anthropic API, controlling length with max tokens, summarizing and rewriting, temperature and top_p, few-shot prompting, conversation roles, system messages, multi-turn conversations, thinking mode, business document analysis.
10. **Model Context Protocol: Advanced Topics:** sampling, log and progress notifications, roots, JSON-RPC message types, the STDIO transport, StreamableHTTP (SSE flow, stateful vs stateless).

docs/MASTER-IN-CLAUDE.md already maps most of these. The gaps most visible against this list:

- Plugin packaging (courses 3 and 7).
- The Agent SDK (course 7).
- Extended thinking (courses 8 and 9).
- temperature and few-shot examples in the API calls (course 9).
- Worktrees (course 7).
- Any one feature that shows several of these working together.

## What Emile wants, in order of importance for tomorrow

### 1. Every course concept used somewhere, and easy to point at

Agents, subagents, MCP, skills, hooks, the API and plugins should each be clearly present, and each one should be easy to explain in the write-up and the video.

He wants the agent setup broken into simple pieces: **one agent per room**.

- **office-agent:** calendar, to-dos, email summaries.
- **kitchen-agent:** fridge, meals, groceries, spending. It can lean on nutrition-analyst.
- **gym-agent:** sessions, lifts, volume. It can lean on gym-data-parser.
- **bedroom-agent:** sleep.

Each one only gets the MCP tools and data for its own room. A simple router or concierge on top decides which room agent handles a request. The existing helper agents (verifier, code-reviewer, gym-data-parser, nutrition-analyst) stay as they are, under or beside these.

### 2. Two editions: Emile's own, and a generic product

This is the business angle.

- **Personal edition:** today's setup, wired to Emile's own sources.
  - Gym: the Apple Notes "gym" note.
  - Kitchen: Lidl Plus receipts and receipt photos.
  - Office: Gmail, Outlook and Google Calendar.
  - Bedroom: sleep data when connected.
- **Generic edition:** for someone who would buy it and doesn't use the same apps. It starts empty, with no data. Each room shows a "connect your source" screen with options, for example:
  - **Kitchen:** your grocery store's app or emailed receipts, a receipt photo, or manual entry.
  - **Gym:** where you log workouts (Apple Notes, Google Sheets, a CSV export from a workout app, or manual).
  - **Office:** Gmail, Outlook or any calendar feed.
  - **Bedroom:** Apple Health, a wearable export, or manual.

The idea that makes this clean: each room reads from a "source adapter" behind one interface, so swapping Apple Notes for a spreadsheet is a new adapter, not a new room. Given one day, it's fine if only a few adapters actually work and the rest are honestly marked "coming soon". What matters is that the empty state, the connect flow and the adapter design are real and visible.

The demo seed script and the ingest endpoints already exist and can be reused. The site name lives in `src/lib/site.ts`.

### 3. A cleaner look when you open a room

The 3D studio stays as the home screen, but opening a room should change.

Today, clicking Office fills about three quarters of the screen with the 3D office and squeezes the Professional Hub (to-dos and calendar) into a side panel. Emile wants a click on a room to open a full-screen page that shows everything at a glance:

- **Office:** the calendar and to-do list side by side, filling the screen.
- **Kitchen:** the fridge, today's meals and spending.
- **Gym:** this week, lifts and volume.
- **Bedroom:** sleep.

Every page should be well organized, look like a real product, need little scrolling and stay calm and aesthetic. The `ui-redesign` branch has started on this with the new office and bedroom pages.

The 3D scene itself (characters, materials, camera smoothness) is out of scope for tomorrow.

## Things that shouldn't change

- The Job Search sheet, its JobsFeed script, and the "Job search review" scheduled task.
- Secrets:
  - `.env.local`, `scripts/.env` and tokens are never printed or committed.
  - Risky database work happens on hub_test.
  - Production (Neon, Vercel settings, merging to main) changes only with Emile's OK.
- House style: plain, understated wording, no em dashes, they/them for Emile.

## How to spend the time

Tomorrow night is a hard stop, and the write-up and video still need updating at the end to show whatever gets added. A sensible split:

1. Map the courses against the repo and confirm the gaps (an hour at most).
2. The room agents, the plugin, and the small API additions (thinking, few-shot) that close course gaps.
3. The full-screen room pages.
4. The generic edition's empty state, connect screens and adapter interface.
5. Updating MASTER-IN-CLAUDE.md, the write-up and the demo script, then deploying.

If time runs short, cutting from the bottom of the generic edition (fewer working adapters) is better than cutting the docs.
