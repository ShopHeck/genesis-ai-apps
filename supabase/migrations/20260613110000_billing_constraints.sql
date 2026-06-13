-- Billing correctness: the stripe-webhook upserts subscriptions with
-- onConflict "user_id", which requires a unique constraint on user_id (the
-- model is one subscription row per user). Without it, checkout completion
-- errors. De-dupe defensively, then add the constraint.

-- Keep the most recent row per user; remove older duplicates.
delete from public.subscriptions s
using public.subscriptions s2
where s.user_id = s2.user_id
  and s.ctid <> s2.ctid
  and s.created_at < s2.created_at;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_user_id_unique'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_user_id_unique unique (user_id);
  end if;
end $$;
