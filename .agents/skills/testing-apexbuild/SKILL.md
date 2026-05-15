---
name: testing-apexbuild
description: Test ApexBuild (genesis-ai-apps) frontend end-to-end. Use when verifying UI changes, code splitting, routing, Generator page functionality, or the full AI generation pipeline.
---

# Testing ApexBuild Frontend

## Prerequisites

- Node.js 18+ installed
- `npm install` completed in the repo root
- `.env` file with Supabase credentials (see Devin Secrets Needed below)
- Dev server may use port 8080 or 8081 (Vite auto-increments if 8080 is in use)

## Starting the Dev Server

```bash
cd /home/ubuntu/genesis-ai-apps
npm run dev
# Serves at http://localhost:8080/ (or 8081 if 8080 is in use)
```

If port 8080 is occupied, Vite will automatically try 8081. Check terminal output for the actual URL.

## .env Setup

The `.env` file is git-ignored. Create it manually:
```bash
VITE_SUPABASE_PROJECT_ID="yntpprkrsuwiaogccirh"
VITE_SUPABASE_ANON_KEY="<from repo-scoped secret VITE_SUPABASE_ANON_KEY>"
VITE_SUPABASE_URL="https://yntpprkrsuwiaogccirh.supabase.co"
```

The anon key is stored as a permanent repo-scoped Devin secret. Check `/run/repo_secrets/ShopHeck/genesis-ai-apps/.env.secrets` for the value.

## Key Test Flows

### 1. Landing Page (`/`)
- Verify hero heading: "Build mobile apps from plain English"
- Navbar: ApexBuild logo, Features, How It Works, Showcase, Pricing, FAQ, Log in, Start Building
- CTA buttons: "Start Building Free" -> `/generator`, "Watch Demo"
- Feature badges: Free trial, Prototype speed, Code ownership, SOC 2
- Check browser console for zero errors

### 2. Code Splitting Verification
- Run `npm run build` and verify separate chunk files exist:
  - Page chunks: `Generator-*.js`, `Dashboard-*.js`, `Pricing-*.js`
  - Vendor chunks: `vendor-react-*.js`, `vendor-motion-*.js`, `vendor-editor-*.js`, `vendor-supabase-*.js`
- Main index bundle should be ~200KB (<=210KB)
- No single chunk should exceed 500KB (Vite warning threshold)
- On production/Netlify preview: open DevTools Network tab, navigate between pages, confirm separate JS chunks load on demand

### 3. Generator Page (`/generator`)
- 30 curated templates visible ("30 curated . click to load" label)
- Click any template card -> prompt textarea fills with template description
- Selected template shows checkmark indicator
- Provider selector shows "Gemini" as default
- "Generate App" button present with sparkle icon
- "Sign in for 3 free builds/mo" link in footer bar
- Back button navigates to home

### 4. Generation Flow (requires backend credentials)

**This flow IS testable** when the Supabase anon key is configured in `.env` and the Gemini API key is set in Supabase secrets.

#### Steps:
1. Clear `apexbuild_anon_uses` from localStorage (browser console: `localStorage.removeItem('apexbuild_anon_uses')`)
2. Navigate to `/generator`
3. Either select a template or type a custom prompt
4. Click "Generate App"
5. Observe progress UI:
   - Button changes to "Generating..." with spinner
   - Textarea and template cards become disabled
   - "BUILDING YOUR APP" section appears below
   - Stage label shows (e.g., "Analyzing your prompt")
   - Elapsed timer counts up with "~20-60s typical" estimate
   - Progress bar fills
   - 3-step indicator: Analyzing -> Generating -> Bundling
   - Terminal log panel shows real SSE messages from Gemini pipeline
6. Wait for completion (20-60 seconds typical)
7. On success, verify:
   - Project header with PascalCase app name
   - "READY FOR XCODE" badge
   - Bundle ID in reverse-DNS format
   - File count (expect >=16 files)
   - File tree with folders and .swift files
   - Code viewer with first file auto-selected
   - "Download .zip" button
   - Interactive preview section

#### Handling Gemini API Errors:
- **503 "high demand"**: This is a transient Google-side issue. Wait 30-60 seconds and retry. Try a simpler prompt if complex ones keep failing. This is NOT an ApexBuild bug.
- **401/403**: Check that the Gemini API key is correctly set in Supabase secrets (not in `.env` — it's a server-side secret)
- **Rate limit**: The edge function has a 5 req/min rate limit per IP. Wait if you hit it.
- Failed generations do NOT count against the anonymous usage quota (correct behavior)

#### Tips:
- Simpler prompts (e.g., "A simple todo list app") are less likely to hit Gemini capacity limits than complex template prompts
- The generation pipeline has 5 phases: Architect -> Designer -> Engineer -> Reviewer -> Refiner
- Each phase calls Gemini separately, so a 503 can occur at any phase

### 5. Pricing Page (`/pricing`)
- Three tiers: Free ($0/mo), Pro ($29/mo), Studio ($99/mo)
- Pro card has "Most popular" badge
- Feature lists for each tier
- CTA buttons: "Get started free", "Upgrade to Pro", "Upgrade to Studio"
- "All plans include" section at bottom

### 6. Dashboard Page (`/dashboard`)
- Auth modal appears immediately: "Sign in to view your dashboard"
- Modal has email input + "Send magic link" button + "Continue with Google"
- Modal dismissible via X button
- Behind modal: "Free Plan" and "0/3 builds this month" visible
- Cannot test authenticated state without test credentials

### 7. 404 Page
- Navigate to any invalid route (e.g., `/nonexistent`)
- Should show "404" heading + "Oops! Page not found" + "Return to Home" link

### 8. Cross-Page Navigation
- Test all navigation paths work without errors:
  - Home -> Generator (CTA or navbar "Start Building")
  - Generator -> Home (Back button)
  - Home -> Pricing (navbar)
  - Pricing -> Generator ("Get started free")
  - 404 -> Home ("Return to Home")
- Check console for errors after rapid navigation

### 9. Netlify Preview
- If a PR is open, check the Netlify deploy preview URL
- Format: `https://deploy-preview-{PR_NUMBER}--genesis-ai-apps.netlify.app`
- Verify landing page loads and matches local dev

## Console Expectations

- **Expected warnings** (pre-existing, not errors):
  - React Router v7 future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`)
  - React DevTools info message
- **Expected on 404 test**: `404 Error: User attempted to access non-existent route: ...`
- **Unexpected**: Any other red errors indicate a real issue

## Error Handling Verification

When generation fails, verify:
- Error banner appears with AlertTriangle icon and red/destructive styling
- Error message shows the actual API error (not just generic text)
- Toast notification appears with error details
- Generate App button re-enables after failure (allows retry)
- No unhandled console errors
- Anonymous usage counter is NOT incremented by failed generations

## Known Limitations

- **Gemini API availability**: The Gemini 2.5 Pro model may return 503 errors during high-demand periods. This is a Google-side issue, not an ApexBuild bug. Retry after waiting.
- **Auth flows**: Supabase auth (magic link + Google OAuth) requires valid Supabase project credentials. The auth modal UI can be tested but not the actual sign-in.
- **Rate limiting**: Server-side IP rate limiting (5 req/min) on the generation endpoint.
- **JWT verification**: Edge function JWT verification is configured via `supabase/config.toml` (`verify_jwt = false` for anonymous access).

## Devin Secrets Needed

- `VITE_SUPABASE_ANON_KEY` (repo-scoped, permanent) — Supabase anonymous/public key. Required for `.env` setup.
- The Gemini API key is configured directly in Supabase secrets (not as a Devin secret) — confirm with the user that it's set.
- For payment testing: `STRIPE_SECRET_KEY` would be needed (not currently configured).
