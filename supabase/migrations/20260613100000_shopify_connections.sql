-- Store connections: links an ApexBuild user to a Shopify store they've
-- authorized, so generation can be grounded in the merchant's real catalog and
-- granted scopes. Access tokens are secrets — only the service role (edge
-- functions) may read them; the client can read non-secret metadata.

create table if not exists public.shopify_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  shop_domain text not null,
  access_token text not null,
  scope text,
  installed_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, shop_domain)
);

alter table public.shopify_connections enable row level security;

-- Only the service role can read/write (the access_token must never reach the client).
create policy "Service role manages shopify connections"
  on public.shopify_connections for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- A non-secret view the client may read to show connection status.
create or replace view public.shopify_connection_status
with (security_invoker = true) as
  select user_id, shop_domain, scope, installed_at
  from public.shopify_connections;

create index if not exists idx_shopify_connections_user on public.shopify_connections(user_id);

-- Transient OAuth nonce store (state param) to prevent CSRF on the callback.
create table if not exists public.shopify_oauth_states (
  state text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  shop_domain text not null,
  created_at timestamptz default now() not null
);

alter table public.shopify_oauth_states enable row level security;

create policy "Service role manages oauth states"
  on public.shopify_oauth_states for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
