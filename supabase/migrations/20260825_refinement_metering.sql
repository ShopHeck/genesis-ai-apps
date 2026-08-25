-- Meter iterativo refinements (refine-project) separately from full builds so
-- they consume the monthly AI spend cap but do NOT consume the build quota or
-- clutter the project dashboard.
--
--   - generations.kind: 'build' (default, a full generate run) | 'refine' (a refine-project call)
--   - count_monthly_generations: counts only kind = 'build' (build quota unchanged)
--   - checkMonthlySpend (edge function) sums ALL cost_usd regardless of kind,
--     so refinements are charged against the spend ceiling.
--
-- Existing rows are backfilled as 'build'.

alter table public.generations
  add column if not exists kind text not null default 'build';

create or replace function public.count_monthly_generations(p_user_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
  from public.generations
  where user_id = p_user_id
    and status = 'success'
    and kind = 'build'
    and created_at >= date_trunc('month', now());
$$;
