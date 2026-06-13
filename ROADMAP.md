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

- **Phase 0 — Foundation & cleanup (this PR).**
  Unify metering across generators on the `generations` table (fixes the broken
  web-app quota that referenced a non-existent schema), add durable server-side
  anonymous limits, gate premium providers, add lint/test/build CI, fix the
  edge-function deploy gap, and lay Shopify groundwork (`_shared/shopify.ts`).
  iOS removal is deferred to Phase 1 (it is removed as part of the generator
  retarget, to avoid a broken intermediate state).

- **Phase 1 — Generator MVP (in progress).** `generate-shopify-app` produces an
  embedded admin app from the React Router template (Architect → Engineer →
  Reviewer, scaffold injection, Built-for-Shopify review, shared metering). The
  generator UI is retargeted to Shopify + web and the iOS target is removed.
  Remaining: validate generated apps against `shopify app dev` end-to-end and
  wire GraphQL operation validation into the pipeline (rolls into Phase 2).

- **Phase 2 — Real preview + store grounding.** Live embedded preview against a
  connected dev store; generation grounded in the merchant's real products and
  scopes; conversational iterate-and-rebuild loop.

- **Phase 3 — Compliance & ship.** Built-for-Shopify reviewer, scope
  minimization, protected-data handling, GitHub + CLI deploy, auto-filled App
  Store submission kit.

- **Phase 4 — Breadth & moat.** More archetypes (admin/checkout/POS extensions,
  sales channels), template gallery, agency/multi-store workspaces, and
  regenerate-against-new-API-version upgrades.
