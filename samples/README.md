# Sample generated apps

This folder holds a small, committed sample of apps that `generate-shopify-app` /
`generate-web-app` produce (one per target). They are the regression harness for
**Generated App CI** (`.github/workflows/generated-app-ci.yml`): on a weekly schedule (and on
`workflow_dispatch`) the workflow runs `tsc --noEmit` and `eslint` on each sample, so model
drift — or a template / Admin API change that silently breaks generated output — surfaces
before it reaches users.

## How to seed / refresh a sample

The samples must be *real* generated output, not hand-written. To add or refresh one:

1. Run the generator locally (or against a deployed `generate-shopify-app` / `generate-web-app`)
   for a small merchant idea, and download the project `.zip`.
2. Place the unzipped contents under `samples/<name>/` (e.g. `samples/low-stock-alerts/`), including
   its `package.json`, `tsconfig.json`, `shopify.app.toml`, and source.
   - For a Shopify sample, include the scaffold + generated `app/` + `prisma/` + config files so the
     sample realistically represents a full build.
3. Commit it. Refresh the sample whenever the scaffold, pinned Admin API version, or the
   engineer prompt changes materially — a stale sample defeats the purpose.

## Why this exists

The app sells "an installable Shopify app," but the generated code is never compiled end-to-end
by us; the only in-app quality sign is a regex compliance score. This CI step, plus a live
`shopify app dev` smoke run against a sample, is what turns "likely works" into "verified works."
