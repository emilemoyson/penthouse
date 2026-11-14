# Skill trigger checks

Run 2026-11-13 on branch `skills`. Each prompt went to a fresh headless session
(`claude -p ... --output-format stream-json --max-turns 3`, with Bash, Edit and Write disabled so nothing changed).
A check passes when the skill was called for a "yes" prompt, and was not called for a "no" prompt.

| Skill | Should fire | Prompt | Skill called | Result |
| --- | --- | --- | --- | --- |
| weekly-food-report | yes | How did I eat this week? Give me my weekly food report. | weekly-food-report | pass |
| weekly-food-report | yes | Did I stay within my grocery budget last week, and did anything go to waste? | weekly-food-report | pass |
| weekly-food-report | no | Give me a high-protein dinner idea from what is in my fridge. | none (used `what_can_i_cook`) | pass |
| verify | yes | I just changed the ingest route. Check everything still works before I commit. | verify | pass |
| verify | yes | Run the build and the tests and tell me if anything is broken. | verify | pass |
| verify | no | Explain what the guard-bash hook does. | none | pass |
| new-ingest-kind | yes | Add a way to log my daily water intake through the ingest API. | new-ingest-kind | pass |
| new-ingest-kind | yes | I want my phone to send step counts to the penthouse. Set up the endpoint for it. | new-ingest-kind | pass |
| new-ingest-kind | no | Change the sleep ingest so recovery can go up to 120 instead of 100. | none | pass |

9 of 9 pass.

Limits: one run per prompt, so this shows the descriptions work, not how often they work. The "no" prompts are
close neighbours on purpose (a cooking question, a code question, an edit to an existing kind).
The `verify` script itself was also run end to end: tsc, build, 20 MCP tests and 4 smoke checks on `hub_test` all pass.
