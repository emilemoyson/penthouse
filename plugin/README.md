# The Office plugin

The skills and agents from this repo, packaged as one Claude plugin so a classmate can install them in a single step instead of copying folders.

- **Skills:** `verify` (the full check before a commit), `weekly-food-report` (spend, protein per dollar, waste, one recommendation), `new-ingest-kind` (adds a data source end to end).
- **Agents:** `verifier` and `code-reviewer` (read-only, a second opinion), `nutrition-analyst` (numbers for the food report), `gym-data-parser` (turns a workout note into sets).

## Install

In Claude Code:

```
/plugin marketplace add emilemoyson/penthouse
/plugin install the-office@the-office
```

Before installing a plugin from someone else, read its skills and agents: they run with your permissions. The `verify` and `new-ingest-kind` skills expect this repo's layout; the agents and the food report work in any project that has the Office MCP server connected.
