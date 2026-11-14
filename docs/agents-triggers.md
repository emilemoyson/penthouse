# Subagent trigger checks

Run 2026-11-13 on branch `subagents`. Each prompt went to a fresh headless session
(`claude -p ... --output-format stream-json --max-turns 10`, Edit, Write and NotebookEdit disabled).
A watcher script recorded the main session's Agent and Skill calls and stopped the run at the first Agent call.
A check passes when the expected agent was started for a "yes" prompt, and no agent was started for a "no" prompt.

## Round 3 (final)

| Agent | Should fire | Prompt | What happened | Result |
| --- | --- | --- | --- | --- |
| verifier | yes | I finished the subagents work on this branch. Get an independent check that it actually works before I commit. | verifier | pass |
| verifier | yes | Double-check the work on this branch, I don't trust it yet. | verifier | pass |
| verifier | no | Explain how the verify script decides between a full and a quick run. | none | pass |
| code-reviewer | yes | Review my uncommitted changes before I commit. | code-reviewer | pass |
| code-reviewer | yes | Look over the diff on this branch for bugs or security problems. | no agent; the main session reviewed it itself (14 tool calls) | fail |
| code-reviewer | no | How does the ingest route check the bearer token? | none | pass |
| nutrition-analyst | yes | Write my weekly food report. | weekly-food-report skill, then nutrition-analyst | pass |
| nutrition-analyst | yes | How did I eat last week? Give me the full report. | weekly-food-report skill, then nutrition-analyst | pass |
| nutrition-analyst | no | What can I cook tonight with what's in the fridge? | none | pass |

8 of 9 pass. The fail: "look over ... for bugs" reads to the main session as a task it can do itself.
Fixed in round 4 below.

## Round 4 (after sharpening the code-reviewer description)

Same method. The description now names "look over, check, audit, go through" and says to hand these to the agent
instead of reading the diff in the main session; CLAUDE.md got a matching line.

| Agent | Should fire | Prompt | What happened | Result |
| --- | --- | --- | --- | --- |
| code-reviewer | yes | Look over the diff on this branch for bugs or security problems. | code-reviewer (1 tool call before) | pass |
| code-reviewer | yes | Review my uncommitted changes before I commit. | code-reviewer (1 tool call before) | pass |
| code-reviewer | no | How does the ingest route check the bearer token? | none | pass |

All 3 pass, so with the 6 other round 3 results that is 9 of 9. Still one run per prompt.

## Earlier rounds and what changed

- Round 1 (`--max-turns 3`): no handoffs at all, because the main session spent its turns exploring first.
  Fix: 10 turns, and stop at the first Agent call.
- Round 2: the main session often did the work itself, used the built-in code-review skill,
  or stopped at an MCP permission prompt. The code-review run did find a real bug: a line break in a command
  got past `.claude/hooks/readonly-bash.mjs`. Fixes: the hook now rejects line breaks and only allows
  read-only `git branch` forms; descriptions start with "Use proactively"; CLAUDE.md got an "Agents and skills"
  section; nutrition-analyst was narrowed to the report path.
- Prompts changed between round 1 and round 3, on purpose: verifier prompt 1 named an "ingest change" that
  did not exist, and the round 1 nutrition prompts asked for single numbers, which the agent is now told not to handle.

## Real runs

- verifier on this branch: PASS. tsc, build, 20 MCP tests and the hub_test smoke test all pass; the real `hub` is untouched.
  It flagged `automation/.Rhistory` as stray (not to be committed).
- code-reviewer on this branch (run headless with `claude -p --agent code-reviewer`): "Fix before commit".
  Found 1 high, 1 medium, 2 low, all in `.claude/hooks/readonly-bash.mjs`:
  `git diff --no-index /dev/null .env.local` could print a secret file; a quoted `'--output=file'` got past the
  write-flag check; the hook allowed the command if it crashed; `$VAR` was not blocked. All four fixed in the hook
  (fails closed, no quotes, backslashes or `$`, denies `--no-index` and secret paths) and tested with allow and deny cases.
  Open: the main session's `guard-bash.mjs` has the same `--no-index` gap, because it only checks secret paths for
  commands like `cat` (see STATUS.md).

## Limits

One run per prompt, so this shows the descriptions can work, not how often they do.
Headless runs have no one to approve prompts, so MCP and Bash permissions affect results.
