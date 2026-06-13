# Roadmap — Pivot to a Shopify app & merchant-tool generator

## Why
The horizontal "prompt → app" market (Lovable, Bolt, Rork) is commoditized and
out-funded. Our defensible wedge is **vertical**: generating installable,
Built-for-Shopify-compliant apps and merchant tools, grounded in the merchant's
real store data via the Shopify Admin API. We build *on top of* Shopify's free
React Router app template — our value is the merchant-specific logic, UI, data
model, real preview, compliance, and one-click submission.

Pinned target: Admin API **2026-04** (see `supabase/functions/_shared/shopify.ts`).

## Phases

- **Phase 0 — Foundation & cleanup. ✅ Done.** Unified metering on the
  `generations` table, durable anonymous limits, provider gating, lint/test/build
  CI, deploy-gap fix, Shopify groundwork (`_shared/shopify.ts`).

- **Phase 1 — Generator MVP. ✅ Done.** `generate-shopify-app` produces an
  embedded admin app on the React Router template (Architect → Engineer →
  Reviewer, scaffold injection, shared metering). UI retargeted to Shopify + web;
  iOS removed.

- **Phase 2 — Store grounding. ✅ (correctness + connection) / ⏳ (live preview).**
  Generation is grounded in schema-validated Admin GraphQL operations, and a
  merchant can OAuth-connect their store so generation uses their real catalog
  and scopes. Remaining: the live in-admin embedded preview (needs
  `shopify app dev`/WebContainers infra) and the conversational rebuild loop.

- **Phase 3 — Compliance & ship. ✅ Done.** Deterministic Built-for-Shopify
  checker, mandatory privacy webhooks, scope minimization signals, and an
  auto-filled App Store submission kit (`STORE_LISTING.md`).

- **Phase 4 — Breadth & moat.** More archetypes (admin/checkout/POS extensions,
  sales channels), template gallery, agency/multi-store workspaces, and
  regenerate-against-new-API-version upgrades.

## Phase 5 — Production hardening & revenue

The path from "works" to "billed, in-market, and trustworthy." Grouped by what
unlocks revenue vs. what protects it.

### Revenue enablers
- **Billing wiring end-to-end.** Verify the Stripe Pro/Studio flow against the
  fixed metering (Phase 0), add the customer portal (cancel/upgrade), and dunning
  for `past_due`. Pricing page already exists — connect it to live checkout.
- **Activation funnel.** Free anonymous trial → sign-in for 3 builds → paid. Add
  an empty-dashboard first-run, "connect store" nudge, and an upgrade prompt at
  the quota wall.
- **Distribution.** Land an agency/partner design partner; publish a sample
  generated app to the App Store to prove the end-to-end path and seed reviews.
- **GitHub export + one-click deploy** of generated apps (push to a repo; deploy
  to a host) — the top conversion driver for "I'll actually ship this."

### Trust / protect revenue
- **Live preview** (Phase 2 remainder) — the "feel real" moment; needs infra.
- **Observability**: Sentry + structured logs + request IDs in every edge
  function; a per-generation cost/latency dashboard.
- **Durable rate limiting** beyond the in-memory burst limiter; abuse/cost caps
  per request (the pipeline can fan out to 6+ model calls).
- **Secrets/config hygiene**: move hardcoded `project_id` to env; rotate the
  `ANON_IP_SALT`; least-privilege review of edge function env.
- **Generated-app CI**: run `shopify app dev`/`tsc` against a sample of generated
  apps in CI to catch model drift before it reaches users.
