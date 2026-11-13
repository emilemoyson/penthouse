-- Read-only role for the Penthouse MCP server.
-- The server only reads through this role. Writes go through /api/ingest with the bearer token.
--
-- Local:  psql -p 5433 -d hub_test -f mcp/sql/readonly_role.sql
-- Neon:   run it once in the Neon SQL editor, then set a password there:
--           alter role penthouse_ro password '<choose one>';
--         (never paste it into chat; put the connection URL in mcp/.env as PENTHOUSE_RO_DATABASE_URL)

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'penthouse_ro') then
    create role penthouse_ro login;
  end if;
end $$;

-- no default access to anything, then SELECT on the tables the server reads
revoke all on all tables in schema public from penthouse_ro;
grant usage on schema public to penthouse_ro;
grant select on pantry_items, grocery_runs, meals, cooks, cook_uses, workouts, sets, exercises, kv to penthouse_ro;

-- every transaction of this role is read-only, even if a grant slips through later
alter role penthouse_ro set default_transaction_read_only = on;
