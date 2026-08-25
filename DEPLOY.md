# Production deployment checklist — ApexBuild

Everything below is the manual/infra work that **cannot be done from the code alone** and
needs your accounts and secrets. All *code* for these is already in the repo on
`audit/production-hardening`. Secrets stay out of git — set them securely, never commit them.

> Secrets live in your Apple Notes. These are the key *shapes* (names + where they go), not
> the values.

## 1. Supabase — migrations, functions, secrets

```bash
# Apply the four DB migrations (already in supabase/migrations/) against the project.
supabase db push --project-ref <ref>

# Deploy every edge function (including the new refine-project and export-to-github).
for fn in generate-shopify-app generate-web-app regenerate-file refine-project \
          evaluate-quality create-checkout-session create-portal-session \
          export-to-github stripe-webhook shopify-oauth generate-app-preview; do
  supabase functions deploy "$fn" --project-ref <ref>
done

# Set the server secrets (values not shared here — rotate ANON_IP_SALT and the API/Stripe keys).
supabase secrets set \
  GEMINI_API_KEY=... ANTHROPIC_API_KEY=... OPENCODE_API_KEY=... \
  STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... \
  STRIPE_PRO_PRICE_ID=... STRIPE_STUDIO_PRICE_ID=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  ANON_IP_SALT="$(openssl rand -hex 24)" \
  MAX_GENERATION_COST_USD=2.0 \
  GITHUB_TOKEN=... GITHUB_OWNER=... \
  --project-ref <ref>
```

- `ANON_IP_SALT` must be rotated from the default; without it the anonymous trial key is
  derivable. Set a fresh random value.
- `GITHUB_TOKEN` needs `Contents` read/write **and** `Repositories` create (or `repo` on a
  classic PAT). `GITHUB_OWNER` controls where exported repos land (the service account or org).
- `supabase/functions/generate-app-preview` is still declared but currently **unwired** — either
  wire it or remove it (it's not called by anything).

## 2. Stripe

- Create the two subscription Prices (Pro $29/mo, Studio $99/mo). Put their IDs in
  `STRIPE_PRO_PRICE_ID` / `STRIPE_STUDIO_PRICE_ID`.
- Point the webhook endpoint at the deployed `stripe-webhook` function URL and subscribe it to:
  `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`, `invoice.paid`. Set `STRIPE_WEBHOOK_SECRET` to the signing secret.
- The webhook now rejects events with a timestamp older than 300s (anti-replay).

## 3. Netlify (the SPA)

- Vite build → `dist/`. Set the three `VITE_*` vars in the Netlify UI (URL, anon key, project id).
- `netlify.toml` currently has only a SPA redirect. Add security headers (CSP, X-Frame-Options,
  Referrer-Policy, Permissions-Policy) and `NODE_VERSION=22`. Consider a website-password or
  Cloudflare in front until launch.

## 4. Generated-app CI (protects service quality)

- Seed `samples/<name>/` with real generated output (see `samples/README.md`), then push. The
  weekly workflow (`.github/workflows/generated-app-ci.yml`) will `tsc --noEmit` + `eslint` each
  one. Until a sample exists the job is a no-op.
- For the strongest signal, also add a manual `shopify app dev` smoke step against a sample in a
  partner store — that's the real "does it install and run" check.

## 5. Observability (optional but recommended)

- Add Sentry (browser + a Deno SDK per edge function) and wire a real DSN via a `SENTRY_DSN`
  secret. Request IDs are available if you thread them through the SSE stream.
- The Dashboard now shows a monthly "AI spend" readout (sums `generations.cost_usd`).

## 6. Launch checks

- Verify the Stripe `checkout.session.completed` → `subscriptions` upsert actually grants Pro/Studio
  (the `get_user_plan` RPC downgrades non-`active`/`trialing` status to `free`, including
  `past_due`).
- Smoke the whole funnel: anon trial → sign-in (3 free) → pay → generate → export to GitHub →
  download.
- Confirm the paste/refine path actually patches code: generate a Shopify app, open the Code tab,
  hit "Regenerate" on a `.tsx` file, and use "Refine with AI" on the Details tab.
