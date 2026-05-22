---
name: testing-apexbuild
description: Test ApexBuild (genesis-ai-apps) frontend end-to-end. Use when verifying UI changes, code splitting, routing, Generator page functionality, or the full AI generation pipeline.
---

# Testing ApexBuild

## Environment Setup

1. Source repo secrets if available: `source /run/repo_secrets/ShopHeck/genesis-ai-apps/.env.secrets 2>/dev/null`
2. Ensure `VITE_SUPABASE_ANON_KEY` is set (starts with `sb_publish_` or `eyJ`, NOT `sb_secret_`)
3. Start dev server: `npm run dev` (runs on http://localhost:8080/)
4. Wait for Vite to report "ready"

## Key Test Flows

### iOS Generation
1. Navigate to /generator
2. Ensure "iOS App" toggle is selected
3. Type a prompt (min 10 chars)
4. Click "Generate App"
5. Wait 60-120s for completion
6. Verify: "READY FOR XCODE" badge, .swift files in tree, Download .zip enabled
7. Verify: iOS preview does NOT auto-trigger (lazy — user must click "Generate Preview")

### Web Generation
1. Navigate to /generator
2. Click "Web App" toggle
3. Type a prompt (min 10 chars)
4. Click "Generate App"
5. Wait 60-120s for completion
6. Verify:
   - Progress labels show "Generating React source files" (NOT Swift)
   - Progress labels show "Bundling web project" (NOT Xcode)
   - "READY TO DEPLOY" badge (NOT "READY FOR XCODE")
   - .tsx/.ts/.css files in tree (NOT .swift)
   - "Download .zip" button enabled
   - Live Sandbox panel shows "Running" with "live code" badge
   - LiveSandbox iframe renders actual React content (NOT blank)
   - NO Xcode Export section

### Tabbed Result Layout
After generation completes, the result section uses a 3-tab bar:
- **Preview tab** (default): LiveSandbox (web) or AppPreview (iOS)
- **Code tab**: ZipPreviewCard + file tree + Monaco editor
- **Details tab**: RefinementChat, QualityScore, ValidationPanel, XcodeExport (iOS only)

Verify:
- All 3 tabs render their content correctly when clicked
- Active tab is highlighted (teal/primary color)
- Clicking a validation issue in Details tab navigates to Code tab with file selected
- Tab state persists when scrolling

### LiveSandbox Verification
The LiveSandbox uses Babel standalone + React CDN to render generated components:
- Should show shimmer loading skeleton briefly while CDN scripts load
- Should render actual React components (headings, text, interactive elements)
- Status should show "Running" (not "Error")
- Console logs panel should be available via the terminal icon
- If rendering errors occur, error message should display (not blank page)

### Anonymous Use Limit
- Anonymous users get 1 free build
- Clear with: `localStorage.removeItem('apexbuild_anon_uses')` then reload
- After 1 build, clicking Generate shows sign-in modal

### Landing Page
- Verify title is "ApexBuild" (not "Genesis" or "Lovable")
- Check navbar, footer, meta tags for consistent branding

## Edge Function Deployment

Functions are in `supabase/functions/`. Deploy with:
```bash
export SUPABASE_ACCESS_TOKEN=<token>
npx supabase link --project-ref yntpprkrsuwiaogccirh
npx supabase functions deploy <function-name> --no-verify-jwt
```

Functions to deploy:
- `generate-ios-app` — iOS generation pipeline
- `generate-web-app` — Web generation pipeline  
- `evaluate-quality` — Vision-based quality scoring
- `generate-app-preview` — Preview HTML generation

### Deno Runtime Gotchas
- Forward slashes in regex must be escaped: `/Features\/.*View\.swift$/` not `/Features/.*View\.swift$/`
- Deno parser interprets unescaped `/` as regex delimiter end
- Error message: "Expression expected at file:///...index.ts:NNN:NN"

## Known Issues & Debugging

### SSE Progress vs Result Race
- The `generate-web-app` function sends `result` event then `progress` event with `percent: 100`
- The `resultReceived` flag in Generator.tsx prevents the progress handler from overriding `setStage("done")`
- If UI gets stuck on "Generating...", check if progress events are resetting the stage

### Gemini API 503 Errors
- The reviewer/refiner phase may hit 503 errors from Gemini
- These are transient availability issues, not code bugs
- The deferred reviewer pattern means the result is already sent to the user
- Retries happen in background; the UI should already show the project

### Quality Check
- Shows "Quality check unavailable" if evaluate-quality function isn't deployed or hits errors
- Requires a separate edge function invocation after generation

## Lint & Typecheck
```bash
npx eslint src/
npx tsc --noEmit
```
