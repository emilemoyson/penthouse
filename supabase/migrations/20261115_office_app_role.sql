-- The app talks to Postgres directly, so the public Supabase Data API (anon / authenticated)
-- gets no access to app tables. The app switches to its own role, office_app, per transaction.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'office_app') then
    create role office_app nologin;
  end if;
end $$;
grant office_app to postgres;
grant usage on schema public, auth to office_app;
grant execute on function auth.uid() to office_app;
grant usage, select on all sequences in schema public to office_app;

-- Copy table and column privileges from authenticated, then remove them from the API roles.
do $$
declare r record;
begin
  for r in select table_name, privilege_type from information_schema.role_table_grants
           where grantee = 'authenticated' and table_schema = 'public'
             and privilege_type in ('SELECT','INSERT','UPDATE','DELETE') loop
    execute format('grant %s on public.%I to office_app', r.privilege_type, r.table_name);
  end loop;
  for r in select table_name, column_name, privilege_type from information_schema.column_privileges
           where grantee = 'authenticated' and table_schema = 'public'
             and table_name in ('user_connectors','ingest_tokens')
             and privilege_type in ('SELECT','INSERT','UPDATE') loop
    execute format('grant %s (%I) on public.%I to office_app', r.privilege_type, r.column_name, r.table_name);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon, authenticated', r.tablename);
    execute format('drop policy if exists own_rows on public.%I', r.tablename);
    execute format('create policy own_rows on public.%I to office_app using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', r.tablename);
  end loop;
end $$;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Child rows may only point at the same user's parent rows (foreign keys ignore RLS).
create or replace function public.owns(tbl text, rid bigint) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare ok boolean;
begin
  if rid is null then return true; end if;
  execute format('select exists(select 1 from public.%I where id = $1 and user_id = (select auth.uid()))', tbl)
    into ok using rid;
  return ok;
end $$;
revoke all on function public.owns(text, bigint) from public, anon, authenticated;
grant execute on function public.owns(text, bigint) to office_app;

create policy parent_owned on public.sets as restrictive to office_app
  using (true) with check (public.owns('workouts', workout_id));
create policy parent_owned on public.cook_uses as restrictive to office_app
  using (true) with check (public.owns('cooks', cook_id) and public.owns('pantry_items', item_id));
create policy parent_owned on public.cooks as restrictive to office_app
  using (true) with check (public.owns('pantry_items', leftover_item_id));
create policy parent_owned on public.meals as restrictive to office_app
  using (true) with check (public.owns('cooks', cook_id));
create policy parent_owned on public.pantry_items as restrictive to office_app
  using (true) with check (public.owns('grocery_runs', run_id));

-- postgres can't grant usage on the auth schema, so office_app inherits it from authenticated
-- (which no longer has any table privileges in public).
grant authenticated to office_app;
