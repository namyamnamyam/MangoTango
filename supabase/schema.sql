-- MangoPen: Supabase schema draft. NOT YET APPLIED.
-- Run only after linking the intended Supabase project and reviewing policies.
-- Both CREATE TABLEs assume Supabase auth.users and pgcrypto/gen_random_uuid.
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_display varchar(40) not null default '익명 작가',
  title varchar(100) not null check (char_length(trim(title)) > 0),
  summary varchar(2000) not null default '',
  genre varchar(40) not null default '기타',
  creation_mode text not null default '직접 집필'
    check (creation_mode in ('직접 집필', 'AI 보조', 'AI 창작')),
  visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists works_author_id_idx on public.works(author_id);
create index if not exists works_public_created_idx
  on public.works(created_at desc) where visibility = 'public';
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  title varchar(100) not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_id,chapter_number)
);
create index if not exists chapters_work_id_idx on public.chapters(work_id);
alter table public.works enable row level security;
alter table public.chapters enable row level security;
revoke all on public.works from anon, authenticated;
revoke all on public.chapters from anon, authenticated;
grant select on public.works to anon;
grant select,insert,update,delete on public.works to authenticated;
grant select on public.chapters to anon;
grant select,insert,update,delete on public.chapters to authenticated;

create policy "public can read published works"
  on public.works for select to anon,authenticated
  using (visibility='public');
create policy "authors can read own works"
  on public.works for select to authenticated
  using (author_id=(select auth.uid()));
create policy "authors can add own works"
  on public.works for insert to authenticated
  with check(author_id=(select auth.uid()));
create policy "authors can update own works"
  on public.works for update to authenticated
  using(author_id=(select auth.uid()))
  with check(author_id=(select auth.uid()));
create policy "authors can delete own works"
  on public.works for delete to authenticated
  using(author_id=(select auth.uid()));

create policy "public can read published chapters"
  on public.chapters for select to anon,authenticated
  using (status='published' and exists (
    select 1 from public.works w
    where w.id=work_id and w.visibility='public'
  ));
create policy "authors can read own chapters"
  on public.chapters for select to authenticated
  using (exists (
    select 1 from public.works w
    where w.id=work_id and w.author_id=(select auth.uid())
  ));
create policy "authors can add own chapters"
  on public.chapters for insert to authenticated
  with check (exists (
    select 1 from public.works w
    where w.id=work_id and w.author_id=(select auth.uid())
  ));
create policy "authors can update own chapters"
  on public.chapters for update to authenticated
  using (exists (
    select 1 from public.works w
    where w.id=work_id and w.author_id=(select auth.uid())
  ))
  with check (exists (
    select 1 from public.works w
    where w.id=work_id and w.author_id=(select auth.uid())
  ));
create policy "authors can delete own chapters"
  on public.chapters for delete to authenticated
  using (exists (
    select 1 from public.works w
    where w.id=work_id and w.author_id=(select auth.uid())
  ));
-- TODO: before launching, create automated RLS tests with two users and a guest:
-- guest cannot see private works or drafts; user B cannot edit user A's work;
-- public work + published chapter is visible without login;
-- author cannot change author_id in UPDATE;
-- signup requires email verification and user safety/reporting policies.
