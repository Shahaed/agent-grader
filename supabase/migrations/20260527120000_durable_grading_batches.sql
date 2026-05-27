create table if not exists public.grading_batches (
  id text primary key,
  assignment_id text not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workflow_run_id text,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  total_jobs integer not null default 0,
  completed_jobs integer not null default 0,
  failed_jobs integer not null default 0,
  cancelled_jobs integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.grading_jobs (
  id text primary key,
  batch_id text not null references public.grading_batches(id) on delete cascade,
  assignment_id text not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_asset_id text not null references public.assignment_assets(id) on delete cascade,
  submission_name text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  progress_label text not null default 'Queued',
  current_step integer not null default 0,
  total_steps integer not null default 0,
  error_message text,
  retry_count integer not null default 0,
  result_id text references public.grading_results(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cleared_at timestamptz
);

create index if not exists grading_batches_assignment_created_idx
  on public.grading_batches (assignment_id, created_at desc);

create index if not exists grading_batches_user_updated_idx
  on public.grading_batches (user_id, updated_at desc);

create index if not exists grading_jobs_batch_created_idx
  on public.grading_jobs (batch_id, created_at asc);

create index if not exists grading_jobs_assignment_status_idx
  on public.grading_jobs (assignment_id, status);

create index if not exists grading_jobs_user_idx
  on public.grading_jobs (user_id);

alter table public.grading_batches enable row level security;
alter table public.grading_jobs enable row level security;

drop policy if exists "grading_batches_select_own" on public.grading_batches;
create policy "grading_batches_select_own"
  on public.grading_batches
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "grading_batches_insert_own" on public.grading_batches;
create policy "grading_batches_insert_own"
  on public.grading_batches
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "grading_batches_update_own" on public.grading_batches;
create policy "grading_batches_update_own"
  on public.grading_batches
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "grading_batches_delete_own" on public.grading_batches;
create policy "grading_batches_delete_own"
  on public.grading_batches
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "grading_jobs_select_own" on public.grading_jobs;
create policy "grading_jobs_select_own"
  on public.grading_jobs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "grading_jobs_insert_own" on public.grading_jobs;
create policy "grading_jobs_insert_own"
  on public.grading_jobs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "grading_jobs_update_own" on public.grading_jobs;
create policy "grading_jobs_update_own"
  on public.grading_jobs
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "grading_jobs_delete_own" on public.grading_jobs;
create policy "grading_jobs_delete_own"
  on public.grading_jobs
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.increment_grading_job_retry_count(
  target_assignment_id text,
  target_batch_id text
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.grading_jobs
    set retry_count = retry_count + 1,
        updated_at = now()
    where assignment_id = target_assignment_id
      and batch_id = target_batch_id
      and status = 'queued'
      and cleared_at is null;
$$;
