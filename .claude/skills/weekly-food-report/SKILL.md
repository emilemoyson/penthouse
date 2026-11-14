---
name: weekly-food-report
description: Writes Emile's weekly food report from the penthouse MCP server - spend vs budget, protein per dollar, cost per meal at home vs out, food that went past its date (waste), and one recommendation. Use when asked for a weekly food, kitchen, grocery or spending review or report, or "how did I eat this week". Not for a single meal, a recipe idea, or gym-only questions.
allowed-tools: mcp__penthouse__weekly_summary, mcp__penthouse__get_meals, Read
---

# Weekly food report

## Steps

1. Pick the week. Default: the 7 days ending today. If the user names a week, pass its Monday as `week_start` (YYYY-MM-DD).
2. Call `mcp__penthouse__weekly_summary` once. It returns `spend` (with protein per dollar and cost per meal already worked out), `budget`, `meals`, `waste` and `gym_sessions`. Ignore its `summary` field; you write the report.
3. Map the fields to the report lines with [reference.md](reference.md). Read it the first time you run this skill in a session.
4. Only call `get_meals` (same dates) if the user asks which meals drove a number.
5. Write the report in the format below.

## Format

```
Week of <Mon d> to <Mon d>

Spend      $X of $B budget ($L left)  |  or "no budget set"
Protein    N g for $X = N g per dollar
Per meal   home $X (n meals), out $Y (m meals)
Waste      k items, about $V lost: <names>

Recommendation: <one concrete action for next week, tied to a number above>
```

Rules:
- Plain wording, no em dashes, under 150 words.
- Never invent a number. If a field is missing or zero, write "no data" on that line and say why in a few words.
- One recommendation only, and it must follow from the numbers.

(Item 3 of the roadmap adds a `nutrition-analyst` subagent; once it exists, hand step 3 to it.)
