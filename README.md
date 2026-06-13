# ApexBuild

AI-powered **Shopify app & merchant-tool generator**. Describe a merchant idea in natural language and get an installable, Built-for-Shopify-minded embedded admin app on the official React Router template (App Bridge, Polaris, Admin GraphQL, webhooks, Prisma session storage) — ready to run with `shopify app dev`. A React + Tailwind web-app target is also supported. See `ROADMAP.md` for the product direction.

## Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui + React Router
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **AI**: Gemini 2.5 Pro (default), Claude, Opencode Zen
- **Payments**: Stripe (Pro $29/mo, Studio $99/mo)
- **Deployment**: Netlify

## Local Development

```bash
cp .env.example .env   # fill in your Supabase URL + anon key
npm install
npm run dev             # http://localhost:8080
```

## Edge Functions

Supabase Edge Functions live in `supabase/functions/`:

| Function | Purpose |
|----------|---------|
| `generate-shopify-app` | Shopify pipeline: Architect → Engineer → Reviewer on the React Router template |
| `generate-web-app` | React + Tailwind web-app pipeline |
| `regenerate-file` | Re-generate a single file (Pro+) |
| `evaluate-quality` | Standalone quality scoring |
| `create-checkout-session` | Stripe checkout for plan upgrades |
| `stripe-webhook` | Handles subscription lifecycle events |

Shared edge-function logic lives in `supabase/functions/_shared/`: `ai.ts` (multi-provider client), `quota.ts` + `plan-limits.ts` (unified metering/anti-abuse), and `shopify.ts` (pinned Admin API version + constants).

Deploy with the Supabase CLI:

```bash
supabase functions deploy generate-ios-app --project-ref <ref>
```

## Environment Variables

### Frontend (Vite)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project reference ID |

### Edge Functions (Supabase Secrets)

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `ANTHROPIC_API_KEY` | Anthropic API key (Studio plan) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

## Architecture

```
src/
├── pages/           # Route-level components (lazy-loaded)
├── components/
│   ├── generator/   # Extracted Generator modules (FileTree, AppPreview, etc.)
│   └── ui/          # shadcn/ui primitives
├── data/            # Prompt templates
├── hooks/           # useAuth
└── integrations/    # Supabase client
```

Generator page is code-split into 7 modules to keep the main component under 900 lines. Vendor libraries (React, Framer Motion, Monaco Editor, Supabase) are separated into manual Vite chunks for optimal caching.
