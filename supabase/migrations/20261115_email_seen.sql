-- Gmail messages the Google connector has already read, so each email is only sent to Claude once.
create table if not exists public.email_seen (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  msg_id text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, msg_id)
);
alter table public.email_seen enable row level security;
revoke all on public.email_seen from anon, authenticated;
grant select, insert, delete on public.email_seen to office_app;
drop policy if exists own_rows on public.email_seen;
create policy own_rows on public.email_seen to office_app
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
