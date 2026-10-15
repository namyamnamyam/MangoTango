-- MANGOPEN initial database schema.
-- Apply to a NEW dedicated Supabase project, not an unrelated existing database.
-- No billing, payout, ads, or paid access in this beta.
create extension if not exists pgcrypto;

create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  author_name text not null default '익명 작가' check (char_length(author_name) between 1 and 40),
  genre text not null default '판타지' check (char_length(genre) between 1 and 40),
  synopsis text not null default '' check (char_length(synopsis) <= 2000),
  characters text not null default '' check (char_length(characters) <= 2500),
  creation_mode text not null default 'human'
    check (creation_mode in ('ai','assisted','human')),
  visibility text not null default 'private'
    check (visibility in ('private','public')),
  access_mode text not null default 'free'
    check (access_mode = 'free'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists works_public_recent_idx on public.works(updated_at desc)
  where visibility='public';
create index if not exists works_author_idx on public.works(user_id, updated_at desc);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  number integer not null check (number between 1 and 9999),
  title text not null check (char_length(title) between 1 and 150),
  body text not null default '' check (char_length(body) <= 40000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_id,number)
);
create index if not exists chapters_work_idx on public.chapters(work_id,number);

create or replace function public.mangopen_touch_updated_at()
returns trigger language plpgsql set search_path='' as $fn$
begin
  new.updated_at := now();
  return new;
end
$fn$;
drop trigger if exists mangopen_works_updated_at on public.works;
create trigger mangopen_works_updated_at before update on public.works
for each row execute function public.mangopen_touch_updated_at();
drop trigger if exists mangopen_chapters_updated_at on public.chapters;
create trigger mangopen_chapters_updated_at before update on public.chapters
for each row execute function public.mangopen_touch_updated_at();

alter table public.works enable row level security;
alter table public.chapters enable row level security;
drop policy if exists "works_read" on public.works;
create policy "works_read" on public.works for select to anon,authenticated
using (visibility='public' or user_id=(select auth.uid()));
drop policy if exists "works_create" on public.works;
create policy "works_create" on public.works for insert to authenticated
with check (user_id=(select auth.uid()) and access_mode='free');
drop policy if exists "works_edit" on public.works;
create policy "works_edit" on public.works for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and access_mode='free');
drop policy if exists "works_delete" on public.works;
create policy "works_delete" on public.works for delete to authenticated
using (user_id=(select auth.uid()));

drop policy if exists "chapters_read" on public.chapters;
create policy "chapters_read" on public.chapters for select to anon,authenticated
using (exists (
  select 1 from public.works w
  where w.id = work_id and (w.visibility = 'public' or w.user_id = (select auth.uid()))
));
drop policy if exists "chapters_create" on public.chapters;
create policy "chapters_create" on public.chapters for insert to authenticated
with check (exists (
  select 1 from public.works w where w.id=work_id and w.user_id=(select auth.uid())
));
drop policy if exists "chapters_edit" on public.chapters;
create policy "chapters_edit" on public.chapters for update to authenticated
using (exists (
  select 1 from public.works w where w.id=work_id and w.user_id=(select auth.uid())
))
with check (exists (
  select 1 from public.works w where w.id=work_id and w.user_id=(select auth.uid())
));
drop policy if exists "chapters_delete" on public.chapters;
create policy "chapters_delete" on public.chapters for delete to authenticated
using (exists (
  select 1 from public.works w where w.id=work_id and w.user_id=(select auth.uid())
));

-- Beta usage quota; function is not exposed until the AI server route is ready.
create table if not exists public.generation_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  used integer not null default 0 check (used between 0 and 3),
  primary key(user_id,usage_day)
);
alter table public.generation_usage enable row level security;
revoke all on public.generation_usage from anon,authenticated;
-- Callable only by authenticated users after release; validates auth.uid() and has an atomic cap.
create or replace function public.consume_generation_quota()
returns integer language plpgsql security definer set search_path='' as $fn$
declare
  caller uuid := (select auth.uid());
  current_day date := (now() at time zone 'UTC')::date;
  new_used integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  insert into public.generation_usage(user_id,usage_day,used)
    values(caller,current_day,1)
    on conflict(user_id,usage_day) do update
    set used=public.generation_usage.used+1
    where public.generation_usage.used < 3
  returning used into new_used;
  if new_used is null then return -1; end if;
  return 3-new_used;
end
$fn$;
revoke all on function public.consume_generation_quota() from public,anon,authenticated;
-- Explicitly grant only when rate limit, authentication and AI route are tested.
-- grant execute on function public.consume_generation_quota() to authenticated;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique(work_id,reporter_id)
);
alter table public.reports enable row level security;
drop policy if exists "reports_create" on public.reports;
create policy "reports_create" on public.reports for insert to authenticated
with check (
  reporter_id=(select auth.uid())
  and exists (select 1 from public.works w where w.id=work_id and w.visibility='public')
);

-- Explicitly grant Data API access, keeping restrictions in RLS policies.
grant usage on schema public to anon,authenticated;
grant select on public.works,public.chapters to anon,authenticated;
grant insert,update,delete on public.works,public.chapters to authenticated;
grant insert on public.reports to authenticated;
revoke all on public.reports from anon;
revoke select,update,delete on public.reports from authenticated;
