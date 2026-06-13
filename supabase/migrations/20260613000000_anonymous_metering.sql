-- Durable anonymous usage metering.
-- Replaces the bypassable client-side localStorage counter with a server-side,
-- per-IP (hashed) monthly trial limit. IPs are HMAC-hashed in the edge function
-- before insert — only opaque hashes are stored here.

create table if not exists public.anonymous_generations (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz default now() not null
);

alter table public.anonymous_generations enable row level security;

-- Only the service role (edge functions) may read/write this table.
create policy "Service role manages anonymous generations"
  on public.anonymous_generations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index if not exists idx_anon_gen_ip_hash_created
  on public.anonymous_generations (ip_hash, created_at desc);

-- Count an IP's successful trial builds in the current calendar month.
create or replace function public.count_monthly_anon_generations(p_ip_hash text)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.anonymous_generations
  where ip_hash = p_ip_hash
    and created_at >= date_trunc('month', now());
$$;

-- Add a target column to generations so we can distinguish web / ios / shopify
-- builds in history and analytics. Backfilled as 'web' for existing rows.
alter table public.generations
  add column if not exists target text;

update public.generations set target = 'web' where target is null;

-- Quality score (0-100 from the reviewer) and regeneration lineage, surfaced
-- in the Dashboard. Added here so the columns the UI already reads exist.
alter table public.generations
  add column if not exists review_score int;

alter table public.generations
  add column if not exists parent_generation_id uuid references public.generations(id) on delete set null;
