-- Monetization schema: profiles, subscriptions, generations

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  stripe_customer_id text unique,
  created_at timestamptz default now() not null
);

-- Subscriptions table (synced from Stripe webhooks)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  stripe_subscription_id text unique,
  plan text check (plan in ('free', 'pro', 'studio')) default 'free' not null,
  status text check (status in ('active', 'canceled', 'past_due', 'trialing')) default 'active' not null,
  current_period_end timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Generations table (usage metering + project history)
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  prompt text not null,
  app_name text,
  bundle_id text,
  summary text,
  files jsonb,
  files_count int default 0,
  status text check (status in ('success', 'failed')) default 'success' not null,
  cost_usd decimal(10,6),
  model_used text,
  created_at timestamptz default now() not null
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.generations enable row level security;

-- Profiles policies
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Allow profile creation on sign-up (via trigger)
create policy "Service role can manage profiles"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- Subscriptions policies
create policy "Users can read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can manage subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- Generations policies
create policy "Users can read own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Users can insert own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "Service role can manage generations"
  on public.generations for all
  using (auth.role() = 'service_role');

-- Auto-create profile on user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  -- Create a free subscription by default
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper function: get user's current plan
create or replace function public.get_user_plan(p_user_id uuid)
returns text
language sql
security definer
as $$
  select coalesce(
    (select plan from public.subscriptions
     where user_id = p_user_id and status in ('active', 'trialing')
     order by created_at desc limit 1),
    'free'
  );
$$;

-- Helper function: count generations this month
create or replace function public.count_monthly_generations(p_user_id uuid)
returns int
language sql
security definer
as $$
  select count(*)::int
  from public.generations
  where user_id = p_user_id
    and status = 'success'
    and created_at >= date_trunc('month', now());
$$;

-- Indexes for performance
create index if not exists idx_generations_user_id on public.generations(user_id);
create index if not exists idx_generations_created_at on public.generations(created_at desc);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_stripe_id on public.subscriptions(stripe_subscription_id);
