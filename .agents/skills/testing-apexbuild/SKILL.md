---
name: testing-apexbuild
description: Test ApexBuild (genesis-ai-apps) frontend end-to-end. Use when verifying UI changes, code splitting, routing, or Generator page functionality.
---

# Testing ApexBuild Frontend

## Prerequisites

- Node.js 18+ installed
- `npm install` completed in the repo root
- Dev server runs on port 8080 by default

## Starting the Dev Server

```bash
cd /home/ubuntu/genesis-ai-apps
npm run dev
# Serves at http://localhost:8080/
```

## Key Test Flows

### 1. Landing Page (`/`)
- Verify hero heading: "Build mobile apps from plain English"
- Navbar: ApexBuild logo, Features, How It Works, Showcase, Pricing, FAQ, Log in, Start Building
- CTA buttons: "Start Building Free" → `/generator`, "Watch Demo"
- Feature badges: Free trial, Prototype speed, Code ownership, SOC 2
- Check browser console for zero errors

### 2. Code Splitting Verification
- Run `npm run build` and verify separate chunk files exist:
  - Page chunks: `Generator-*.js`, `Dashboard-*.js`, `Pricing-*.js`
  - Vendor chunks: `vendor-react-*.js`, `vendor-motion-*.js`, `vendor-editor-*.js`, `vendor-supabase-*.js`
- Main index bundle should be ~200KB (≤210KB)
- No single chunk should exceed 500KB (Vite warning threshold)
- On production/Netlify preview: open DevTools Network tab, navigate between pages, confirm separate JS chunks load on demand

### 3. Generator Page (`/generator`)
- 30 curated templates visible ("30 curated · click to load" label)
- Click any template card → prompt textarea fills with template description
- Selected template shows checkmark indicator
- Provider selector shows "Gemini" as default
- "Generate App" button present with sparkle icon
- "Sign in for 3 free builds/mo" link in footer bar
- Back button navigates to home
- **Cannot test actual generation** — requires Supabase edge function API keys

### 4. Pricing Page (`/pricing`)
- Three tiers: Free ($0/mo), Pro ($29/mo), Studio ($99/mo)
- Pro card has "Most popular" badge
- Feature lists for each tier
- CTA buttons: "Get started free", "Upgrade to Pro", "Upgrade to Studio"
- "All plans include" section at bottom

### 5. Dashboard Page (`/dashboard`)
- Auth modal appears immediately: "Sign in to view your dashboard"
- Modal has email input + "Send magic link" button + "Continue with Google"
- Modal dismissible via X button
- Behind modal: "Free Plan" and "0/3 builds this month" visible
- **Cannot test authenticated state** — no test credentials available

### 6. 404 Page
- Navigate to any invalid route (e.g., `/nonexistent`)
- Should show "404" heading + "Oops! Page not found" + "Return to Home" link

### 7. Cross-Page Navigation
- Test all navigation paths work without errors:
  - Home → Generator (CTA or navbar "Start Building")
  - Generator → Home (Back button)
  - Home → Pricing (navbar)
  - Pricing → Generator ("Get started free")
  - 404 → Home ("Return to Home")
- Check console for errors after rapid navigation

### 8. Netlify Preview
- If a PR is open, check the Netlify deploy preview URL
- Format: `https://deploy-preview-{PR_NUMBER}--genesis-ai-apps.netlify.app`
- Verify landing page loads and matches local dev

## Console Expectations

- **Expected warnings** (pre-existing, not errors):
  - React Router v7 future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`)
  - React DevTools info message
- **Expected on 404 test**: `404 Error: User attempted to access non-existent route: ...`
- **Unexpected**: Any other red errors indicate a real issue

## Known Limitations

- **AI Generation**: Requires Supabase edge function with configured API keys (Gemini). Cannot test generation flow without backend setup.
- **Auth flows**: Supabase auth (magic link + Google OAuth) requires valid Supabase project credentials. The auth modal UI can be tested but not the actual sign-in.
- **Rate limiting**: Server-side IP rate limiting (5 req/min) on the generation endpoint — not testable from frontend alone.
- **JWT verification**: Edge function JWT verification is a deploy-time configuration, not testable locally.

## Devin Secrets Needed

No secrets are required for frontend-only testing. For full backend testing, the following would be needed:
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_ANON_KEY` — Supabase anonymous key
- `GEMINI_API_KEY` — Google Gemini API key (for generation testing)
- `STRIPE_SECRET_KEY` — Stripe key (for payment testing)
