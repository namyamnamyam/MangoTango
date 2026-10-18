-- MangoPen v0.5 social community (non-destructive; existing works and chapters remain unchanged)
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null check (char_length(display_name) between 1 and 40),
 bio text not null default '' check (char_length(bio) <= 300),
 avatar_path text check (avatar_path is null or char_length(avatar_path) <= 400),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

create table if not exists public.follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 following_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (follower_id, following_id),
 constraint cannot_follow_self check (follower_id <> following_id)
);
create index if not exists follows_following_id_idx on public.follows(following_id);

create table if not exists public.posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(trim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_author_date_idx on public.posts(author_id, created_at desc);

create table if not exists public.post_likes (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (post_id,user_id)
);
create index if not exists post_likes_user_id_idx on public.post_likes(user_id);

create table if not exists public.post_reports (
 post_id uuid not null references public.posts(id) on delete cascade,
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check (char_length(reason) between 2 and 200),
 created_at timestamptz not null default now(),
 primary key (post_id,reporter_id)
);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_reports enable row level security;

create policy "profiles_public_read" on public.profiles for select to anon,authenticated using (true);
create policy "profiles_owner_insert" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_owner_update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles_owner_delete" on public.profiles for delete to authenticated using (id = (select auth.uid()));

create policy "follows_public_read" on public.follows for select to anon,authenticated using (true);
create policy "follows_owner_insert" on public.follows for insert to authenticated with check (follower_id = (select auth.uid()) and follower_id <> following_id);
create policy "follows_owner_delete" on public.follows for delete to authenticated using (follower_id = (select auth.uid()));

create policy "posts_public_read" on public.posts for select to anon,authenticated using (true);
create policy "posts_owner_insert" on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy "posts_owner_delete" on public.posts for delete to authenticated using (author_id = (select auth.uid()));
create policy "posts_owner_update" on public.posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));

create policy "post_likes_public_read" on public.post_likes for select to anon,authenticated using (true);
create policy "post_likes_owner_insert" on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "post_likes_owner_delete" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "post_reports_own_read" on public.post_reports for select to authenticated using (reporter_id = (select auth.uid()));
create policy "post_reports_own_insert" on public.post_reports for insert to authenticated with check (reporter_id = (select auth.uid()));

grant select on public.profiles,public.follows,public.posts,public.post_likes to anon,authenticated;
grant insert,update,delete on public.profiles,public.posts to authenticated;
grant insert,delete on public.follows,public.post_likes to authenticated;
grant select,insert on public.post_reports to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('mangopen-avatars','mangopen-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create policy "mangopen_avatars_upload_own_folder" on storage.objects for insert to authenticated
with check (bucket_id='mangopen-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "mangopen_avatars_update_own_folder" on storage.objects for update to authenticated
using (bucket_id='mangopen-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='mangopen-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "mangopen_avatars_delete_own_folder" on storage.objects for delete to authenticated
using (bucket_id='mangopen-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "mangopen_avatars_read_public" on storage.objects for select to anon,authenticated
using (bucket_id='mangopen-avatars');
