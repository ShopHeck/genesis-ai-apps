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
cd /home/ubuntu/repos/genesis-ai-apps
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
- 30 curated templates visible ("30 curated \u00b7 click to load" label)
- Click any template card -> prompt textarea fills with template description
- Selected template shows checkmark indicator (blue circle with Check icon, top-right of card)
- Provider selector shows "Gemini" as default
- "Generate App" button present with sparkle icon
- "Sign in for 3 free builds/mo" link in footer bar
- Back button navigates to home

#### Template Categories
The 30 templates span 9 categories. When verifying templates, check:
- **New categories** (added in template overhaul): Creator (5 templates, orange accent), Business (5 templates, green accent), Design (5 templates, teal accent)
- **Kept categories**: Creative, Outdoors, Social, Finance, Utility, Gaming
- Category labels render as uppercase text above the template label, colored with the template's accent color

#### Template Interaction Testing
1. Click a template -> textarea fills with the full prompt text
2. Click a different template -> textarea updates, previous template loses checkmark (single-select)
3. Verify checkmark appears only on the currently selected template
4. Use browser console to verify template count: `document.querySelectorAll('button[title]').length` should return 30 (plus any non-template buttons)

#### Verifying Removed Templates
If templates were replaced (e.g., oversaturated templates removed), verify via DOM search:
```javascript
const allText = Array.from(document.querySelectorAll('button[title]')).map(b => b.title + ' ' + b.textContent).join(' ');
// Check specific removed template names:
console.log(allText.includes('Lunar mood journal')); // should be false
```

### 4. Generation Flow (requires backend credentials)

**This flow IS testable** when the Supabase anon key is configured in `.env` and the Gemini API key is set in Supabase secrets.

#### Pipeline Architecture (as of PR #16/#17)
The generation pipeline has been optimized for speed:
- **Phases 1-3 (blocking)**: Architect (gemini-2.5-flash) -> Designer -> Engineer (gemini-2.5-pro)
- **Phases 4-5 (deferred)**: Reviewer + Refiner run async AFTER the project result is streamed to the user
- The user sees the project immediately after the Engineer phase completes
- If the Reviewer finds issues, a `patch` SSE event hot-swaps the files in the UI
- If approved without changes, a `review` SSE event shows the quality score

#### SSE Event Types
- `progress` — phase updates with percent, message
- `result` — project data (files, appName, bundleId, summary)
- `patch` — deferred review patches (files array, reviewScore, reviewSummary)
- `review` — review-only result (reviewScore, reviewSummary, no file changes)
- `error` — generation failure

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
6. Wait for completion (60-120 seconds typical with speed optimizations)
7. On success, verify:
   - Project header with PascalCase app name
   - "READY FOR XCODE" badge
   - Bundle ID in reverse-DNS format
   - File count (expect >=16 files)
   - File tree with folders and .swift files
   - Code viewer with first file auto-selected
   - "Download .zip" button
   - Interactive preview section
8. After result appears, watch for deferred review:
   - Terminal log may show "[reviewer]" messages
   - Toast "Review complete \u2014 files updated with quality fixes" if patches applied
   - Or quality score log entry if approved without changes

#### Handling Gemini API Errors:
- **503 "high demand"**: This is a transient Google-side issue. Wait 30-60 seconds and retry. Try a simpler prompt if complex ones keep failing. This is NOT an ApexBuild bug.
- **401/403**: Check that the Gemini API key is correctly set in Supabase secrets (not in `.env` \u2014 it's a server-side secret)
- **Rate limit**: The edge function has a 5 req/min rate limit per IP. Wait if you hit it.
- **"model did not return a tool call \u2014 retrying"**: Flash model returned text instead of functionCall. The fix (PR #17) auto-retries this. If it persists after 3 retries, it's a transient Gemini issue.
- **"File ... contains placeholder content"**: Validation error where the Engineer generates files with placeholder/stub content. This is a pre-existing quality issue, not a pipeline bug. Retrying with a simpler prompt may help.
- Failed generations do NOT count against the anonymous usage quota (correct behavior)

#### Tips:
- Simpler prompts (e.g., "A simple todo list app") are less likely to hit Gemini capacity limits than complex template prompts
- Each phase calls Gemini separately, so a 503 can occur at any phase
- For Playwright-based testing, use CDP at `http://localhost:29229` to connect to the running browser

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
- **Important**: Netlify preview may render blank if Supabase env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are not configured in the Netlify project settings. If the preview shows an empty `#root` div, use the local dev server instead.
- When Netlify env vars are configured, verify landing page loads and matches local dev

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
- "Try again" button in the error banner clears error and restarts generation
- Toast notification appears with error details
- Generate App button re-enables after failure (allows retry)
- No unhandled console errors
- Anonymous usage counter is NOT incremented by failed generations

## Known Limitations

- **Gemini API availability**: The Gemini 2.5 Pro model may return 503 errors during high-demand periods. This is a Google-side issue, not an ApexBuild bug. Retry after waiting.
- **Auth flows**: Supabase auth (magic link + Google OAuth) requires valid Supabase project credentials. The auth modal UI can be tested but not the actual sign-in.
- **Rate limiting**: Server-side IP rate limiting (5 req/min) on the generation endpoint.
- **JWT verification**: Edge function JWT verification is configured via `supabase/config.toml` (`verify_jwt = false` for anonymous access).
- **Netlify preview blank page**: The React app requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to initialize. Without these env vars in Netlify project settings, the preview renders a blank page with empty `#root` div. Use local dev server as fallback.
- **Placeholder content validation**: The Engineer (gemini-2.5-pro) sometimes generates files with placeholder/stub content that fails the `validateProject()` check. This is intermittent and more common with complex prompts.

## Devin Secrets Needed

- `VITE_SUPABASE_ANON_KEY` (repo-scoped, permanent) \u2014 Supabase anonymous/public key. Required for `.env` setup.
- The Gemini API key is configured directly in Supabase secrets (not as a Devin secret) \u2014 confirm with the user that it's set.
- `NETLIFY_AUTH_TOKEN` (org-scoped, permanent) \u2014 for Netlify CLI operations (env vars, deploys).
- For payment testing: `STRIPE_SECRET_KEY` would be needed (not currently configured).
