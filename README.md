# ApexBuild

Generate production-grade SwiftUI iOS apps from natural language prompts. Describe your idea, get a complete Xcode project with Swift 6, SwiftData, NavigationStack, and accessibility built in.

## Architecture

**Frontend** — React 18 + Vite + Tailwind CSS + shadcn/ui

**Backend** — Supabase Edge Functions (Deno/TypeScript)

**AI Pipeline** — Five-phase generation:

1. **Architect** — Plans app structure, screens, data model, and design system
2. **Designer** — Per-screen UI spec (Claude path only)
3. **Engineer** — Generates full Swift source with strict concurrency
4. **Reviewer** — Quality gate against acceptance criteria
5. **Refiner** — Targeted patches for failures

**Auth** — Supabase Auth (magic link + Google OAuth)

**Payments** — Stripe Checkout with three tiers:
- Free: 3 generations/month
- Pro ($29/mo): 30 generations/month, Gemini
- Studio ($99/mo): Unlimited, all AI providers (Gemini, Claude, Opencode)

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment template and fill in your Supabase keys
cp .env.example .env

# Start dev server
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_URL` | Supabase project URL |

### Supabase Edge Functions

Edge functions live in `supabase/functions/`:

| Function | Purpose |
|---|---|
| `generate-ios-app` | Main 5-phase AI generation pipeline (SSE streaming) |
| `generate-app-preview` | Interactive HTML/CSS/JS prototype generator |
| `regenerate-file` | AI-powered single file regeneration (Pro+) |
| `create-checkout-session` | Stripe Checkout session creation |
| `stripe-webhook` | Stripe webhook handler (subscriptions) |

Deploy functions:

```bash
supabase functions deploy generate-ios-app --project-ref <ref>
supabase functions deploy generate-app-preview --project-ref <ref>
```

### Database Setup

Run the migration in `supabase/migrations/20260512000000_monetization.sql` to create the required tables (profiles, subscriptions, generations) and RLS policies.

## Build

```bash
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

## Project Structure

```
src/
  pages/          Index, Generator, Dashboard, Pricing, NotFound
  components/
    generator/    Extracted Generator sub-components (FileTree, ValidationPanel, AppPreview, etc.)
    ui/           shadcn/ui components
  data/           Prompt templates
  hooks/          useAuth
  integrations/   Supabase client
supabase/
  functions/      Edge functions (Deno)
  migrations/     SQL migrations
```

## License

Private — all rights reserved.
