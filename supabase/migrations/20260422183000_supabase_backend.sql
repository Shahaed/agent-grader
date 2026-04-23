create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  course_profile jsonb not null default '{}'::jsonb,
  assignment_profile jsonb not null default '{}'::jsonb,
  level_profile text not null,
  rubric_text text not null default '',
  normalized_rubric jsonb not null default '{}'::jsonb,
  vector_store_id text,
  context_summary text not null default ''
);

create table if not exists public.assignment_assets (
  id text primary key,
  assignment_id text not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_type text not null check (asset_type in ('rubric', 'prompt', 'reading', 'anchor', 'submission')),
  name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  storage_bucket text not null,
  storage_path text not null,
  openai_file_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.grading_results (
  id text primary key,
  assignment_id text not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_asset_id text not null references public.assignment_assets(id) on delete cascade,
  submission_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  overall_score numeric not null default 0,
  scale_max numeric not null default 0,
  confidence numeric not null default 0,
  review jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  prompt_results jsonb not null default '[]'::jsonb,
  retrieval_sources jsonb not null default '[]'::jsonb
);

create index if not exists assignments_user_updated_idx
  on public.assignments (user_id, updated_at desc);

create index if not exists assignment_assets_assignment_created_idx
  on public.assignment_assets (assignment_id, created_at desc);

create index if not exists assignment_assets_user_idx
  on public.assignment_assets (user_id);

create index if not exists grading_results_assignment_created_idx
  on public.grading_results (assignment_id, created_at desc);

create index if not exists grading_results_source_asset_idx
  on public.grading_results (source_asset_id);

create index if not exists grading_results_user_idx
  on public.grading_results (user_id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();

insert into storage.buckets (id, name, public)
values ('assignment-files', 'assignment-files', false)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_assets enable row level security;
alter table public.grading_results enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "assignments_select_own" on public.assignments;
create policy "assignments_select_own"
  on public.assignments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "assignments_insert_own" on public.assignments;
create policy "assignments_insert_own"
  on public.assignments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "assignments_update_own" on public.assignments;
create policy "assignments_update_own"
  on public.assignments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "assignments_delete_own" on public.assignments;
create policy "assignments_delete_own"
  on public.assignments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "assignment_assets_select_own" on public.assignment_assets;
create policy "assignment_assets_select_own"
  on public.assignment_assets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "assignment_assets_insert_own" on public.assignment_assets;
create policy "assignment_assets_insert_own"
  on public.assignment_assets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "assignment_assets_update_own" on public.assignment_assets;
create policy "assignment_assets_update_own"
  on public.assignment_assets
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "assignment_assets_delete_own" on public.assignment_assets;
create policy "assignment_assets_delete_own"
  on public.assignment_assets
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "grading_results_select_own" on public.grading_results;
create policy "grading_results_select_own"
  on public.grading_results
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "grading_results_insert_own" on public.grading_results;
create policy "grading_results_insert_own"
  on public.grading_results
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "grading_results_update_own" on public.grading_results;
create policy "grading_results_update_own"
  on public.grading_results
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "grading_results_delete_own" on public.grading_results;
create policy "grading_results_delete_own"
  on public.grading_results
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "assignment_files_select_own" on storage.objects;
create policy "assignment_files_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "assignment_files_insert_own" on storage.objects;
create policy "assignment_files_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "assignment_files_update_own" on storage.objects;
create policy "assignment_files_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "assignment_files_delete_own" on storage.objects;
create policy "assignment_files_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
