# Penthouse MCP server

A Python MCP server (official `mcp` SDK 2.x, `MCPServer`, formerly FastMCP) that lets Claude read the Kitchen and Gym data of the dashboard and import Lidl receipts.

- **Reads** use a read-only Postgres role (`penthouse_ro`). The role only has `SELECT` on the tables it needs and every transaction is read-only. The server also marks each session read-only.
- **The one write** (`import_receipts`) goes through `POST /api/ingest/groceries` with the bearer token, like every other script that feeds the dashboard. The server never writes to the database itself.

## What it offers

| Kind | Name | What |
| --- | --- | --- |
| Tool | `get_pantry(place?)` | Open items: amount left, price, macros, use-by, days left, `size_guessed` |
| Tool | `get_meals(date_from, date_to)` | Meals with kcal, macros, cost, home or out |
| Tool | `get_spend(date_from, date_to)` | Groceries and eating out per day, cost per meal home vs out, protein per dollar |
| Tool | `get_workouts(date_from, date_to)` | Gym sessions with sets, best estimated 1RM (Epley) per exercise |
| Tool | `what_can_i_cook(servings?, notes?)` | 3 dish ideas from the pantry, expiring items first. **Sampling** |
| Tool | `weekly_summary(week_start?, weekly_budget?)` | Spend vs budget, protein per dollar, home vs out, waste, gym sessions. **Sampling** |
| Tool | `import_receipts(folder, dry_run=true)` | Lidl `.txt`/`.html` receipts into the pantry. **Roots, progress, logging** |
| Resource | `penthouse://pantry` | Open pantry as JSON |
| Resource template | `penthouse://meals/{date}` | Meals on one day |
| Prompt | `weekly-review(week_start?)` | Calls `weekly_summary` and `get_workouts`, asks for a review with one recommendation |

### Advanced MCP features, and why each one is here

- **Sampling** (`what_can_i_cook`, `weekly_summary`): the server computes every number in Python from the database and asks the *client's* model only to write the text. The server needs no API key, and the prompt tells the model not to invent numbers. If the client can't sample, the tool returns the numbers with a note, and the calling model writes the text itself. Nothing fails silently.
- **Roots** (`import_receipts`): the server reads receipt files only inside folders the client shared. Claude Code shares the project folder. A client with no roots gets a clear refusal.
- **Progress and log notifications** (`import_receipts`): one progress step and one log line per receipt ("Saved 2 items from Lidl.", "Already saved.", "skipped: nothing before the payment block").
- **Card data stays on the Mac**: each receipt is cut before the payment block and its food lines are parsed locally, with the same rules as `scripts/lidl_sync.py`. Only the food lines are sent. Photos are not accepted (see limits).

Sampling and roots are used through the SDK's `Resolve(...)` resolvers. This makes them work on both the 2025-11-25 protocol (server-to-client requests) and 2026-07-28 (input-required round trips).

## Run it

You need Python 3.10 or newer (macOS ships 3.9; use Homebrew `python3.12`) and the dashboard's Postgres.

From the repo root, one command at a time in Terminal:

```bash
# 1. Install
/opt/homebrew/bin/python3.12 -m venv mcp/.venv
mcp/.venv/bin/pip install -e "mcp[dev]"

# 2. A test copy of the database, with the read-only role
createdb -p 5433 -T hub hub_test
psql -p 5433 -d hub_test -f mcp/sql/readonly_role.sql

# 3. Point the server at it (mcp/.env is git-ignored)
echo 'PENTHOUSE_RO_DATABASE_URL=postgres://penthouse_ro@localhost:5433/hub_test' > mcp/.env

# 4. Tests (20, about 2 seconds)
mcp/.venv/bin/pytest mcp
```

**Claude Code**: `.mcp.json` in the repo root registers the server over STDIO. Start `claude` in the repo root, approve the `penthouse` server, and check it with `/mcp`.

**Claude Desktop**: add to `claude_desktop_config.json`:

```json
{ "mcpServers": { "penthouse": { "command": "/ABSOLUTE/PATH/penthouse/mcp/.venv/bin/penthouse-mcp" } } }
```

**HTTP** (StreamableHTTP, local only): put `MCP_HTTP_TOKEN=<at least 24 random characters>` in `mcp/.env`, run `mcp/.venv/bin/penthouse-mcp --http`, and connect to `http://127.0.0.1:8765/mcp` with `Authorization: Bearer <token>`. Without the token every request gets 401.

**Inspector** (to see sampling and roots work by hand): `npx @modelcontextprotocol/inspector mcp/.venv/bin/penthouse-mcp`.

### Settings

Read from the environment first, then `mcp/.env`. Values are never printed or returned by a tool.

| Name | For |
| --- | --- |
| `PENTHOUSE_RO_DATABASE_URL` | Read-only connection (role `penthouse_ro`) |
| `INGEST_URL`, `INGEST_TOKEN` | `import_receipts`, falls back to `scripts/.env` |
| `MCP_HTTP_TOKEN` | HTTP transport only |

For Neon: run `sql/readonly_role.sql` once in the Neon SQL editor, set a password there for `penthouse_ro`, and put that connection URL in `mcp/.env`.

## Three example conversations

Recorded with Claude Code (headless, `claude -p`) against the `hub_test` copy on 2026-11-04. The tool calls are real. The answers are shortened.

**1. "What can I cook tonight for one? Use up what expires first."**
Claude calls `what_can_i_cook {"servings": 1, "notes": "Use up items that expire first."}`. Claude Code doesn't support sampling, so the tool returns the ranked pantry with the note, and Claude writes the ideas itself:
> Cook the chicken thighs, the first safe thing to use (3 days left). Tonight: chicken thigh and tomato quesadillas, about 55 to 60 g of protein and $3.50 of food. First, a food safety note: four items show as 11 days past their date. Throw out the beef rigatoni leftovers and the fresh chicken; check the yogurt and cheddar before using them. Eggs and milk have 4 days left.

**2. "How much did I spend on food from Oct 19 to Oct 25, and what did a meal cost at home vs eating out?"**
Claude calls `get_spend {"date_from": "2026-10-19", "date_to": "2026-10-25"}`:
> You spent $32.69, all of it one grocery run on Oct 19. Nothing was logged for eating out. A meal at home cost $3.48 on average, but that comes from only 2 meals. Protein per dollar: 19.5 g. That week has very little logged, so these figures probably understate the real spend.

**3. "Import the receipts in mcp/tests/fixtures/receipts, but only a dry run. What would be added?"**
Claude calls `import_receipts {"folder": ".../mcp/tests/fixtures/receipts", "dry_run": true}`:
> Nothing was written. A real import would add 2 receipts with 4 items: chicken thighs 2.1 lb $7.99 and bananas $0.79 (Nov 2), whole milk $3.19 and 18 eggs $4.49 (Nov 3). These files are test fixtures, so importing them for real would add sample groceries to your actual pantry.

The real import was tested through the same tool against a dev server on `hub_test`. It saved 2 receipts (Claude turned 2.1 lb of chicken into 952 g). A second run answered "Already saved." for both. Asking for a folder outside the project was refused: "outside the client's roots (/Users/emilemoyson/code/penthouse)".

## Tests

`mcp/tests/` (pytest, in-memory MCP client, `hub_test`):

- every tool, resource and the prompt; tool counts match direct SQL counts
- sampling: the prompt contains only real pantry items; without sampling, the note is returned
- roots: no roots, a folder outside the roots and `/etc` are all refused
- progress and logs per receipt; card numbers never appear in the output
- the read-only role can't insert
- HTTP: 401 with no token or a wrong token, 200 with the right one
- `kitchen.py` gives the same numbers as `src/lib/kitchen.ts`; `receipts.py` regexes match `scripts/lidl_sync.py`

## Known limits

- **Sampling and roots are deprecated** in the MCP 2026-07-28 spec (SEP-2577), along with client logging. The SDK still supports them, and this server uses them as the course teaches, but they may be removed in a later spec.
- **Claude Code does not support sampling** (checked 2026-11-04), so in Claude Code the two sampling tools always use the fallback. The sampling path is covered by the tests and can be tried by hand in the MCP Inspector.
- **Waste** counts what is left *now* of items whose date passed in that week. The database doesn't keep what was left on the use-by day, so an item finished after its date isn't counted.
- **Duplicate receipts**: a file import uses `extId = file:<hash>`, and the Lidl Plus sync uses `lidl:<id>`. Importing a receipt by file that the sync already sent creates a second grocery run.
- **No receipt photos** through MCP: card details can't be cut reliably from an image.
- **HTTP is local only**. Sampling and roots need a stateful session, which doesn't fit Vercel functions, so it isn't deployed.
- `kitchen.py` and `receipts.py` are ports of the TypeScript and Python originals. The tests catch drift for the cases they cover, not all of them.
