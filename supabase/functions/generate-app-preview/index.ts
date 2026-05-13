// Generates an interactive HTML/CSS/JS prototype of the iOS app concept.
// Accepts the architect's plan JSON so the preview is spec-driven rather than
// a fresh hallucination — correct colors, screens, navigation, and seed data.
// The preview is responsive: it adapts its layout to the viewport width so the
// frontend can display it in Mobile / Tablet / Desktop device frames.

import { callAI, AIError, DEFAULT_MODELS, getApiKey, Provider } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an elite UI prototyper who creates breathtaking interactive web previews of iOS app concepts. Your output is a single self-contained HTML file that feels indistinguishable from a real native app when viewed in a browser.

## Non-negotiable requirements

### Structure
- Output a SINGLE complete HTML document starting with <!DOCTYPE html>. All CSS in <style>, all JS in <script>.
- No external resources, no CDN links, no images (use CSS shapes, gradients, and unicode/emoji glyphs only).
- Must work in a sandboxed iframe with only allow-scripts.

### Responsive layout
- The page MUST respond to its actual viewport width. Use CSS custom properties and media queries:
  - viewport ≤ 480px  → "mobile" layout: full-bleed, 390px wide content, tab bar at bottom
  - 481px – 900px     → "tablet" layout: sidebar nav + content area, card grid, no tab bar
  - viewport ≥ 901px  → "desktop" layout: sidebar nav + main + detail panel, dense info hierarchy
- Use CSS Grid and Flexbox. Do NOT use fixed pixel widths for the page body.
- Each layout must look polished and purpose-built — not just a stretched mobile layout.

### iOS-faithful mobile aesthetic (applies in all viewports)
- Font: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif
- iOS dark-mode colors (default):
  - Background stack:  label=#000000, systemBackground=#1C1C1E, secondarySystemBackground=#2C2C2E, tertiarySystemBackground=#3A3A3C
  - Separators: #38383A, #48484A
  - Labels: primary=#FFFFFF, secondary=rgba(235,235,245,0.6), tertiary=rgba(235,235,245,0.3)
  - Use the app's accentColor for all interactive elements, active states, badges
- iOS light-mode via prefers-color-scheme: backgrounds #F2F2F7, #FFFFFF, accents in the provided color
- Large Title navigation style: bold 34px title that collapses on scroll (JS IntersectionObserver)
- Tab bar: blurred glass (backdrop-filter: blur(20px) saturate(180%)), 49px tall, SF-style icons + labels
- Cards: rounded rect with radius matching the plan's cornerRadius. Subtle shadow. On tap: scale(0.97) → scale(1) in 120ms
- Haptic feel: all interactive elements scale on :active { transform: scale(0.95); transition: 80ms }

### Navigation
- Implement a full navigation STACK (not just tabs). Each tab has its own stack.
- Push/pop navigation: slide-in-from-right at 300ms cubic-bezier(0.4,0,0.2,1) on push, reverse on pop.
- Back button in nav bar that pops. Nav bar title fades and morphs between stack levels.
- Bottom sheets: slide up from bottom with backdrop blur + dark overlay. Dismiss on tap overlay or drag.
- Modals: scale up from 0.94 + fade in. Dismiss button top-right.

### State machine
Use a clean JS state machine. Persist nothing (no localStorage). State includes:
- currentTab: which tab is active
- stacks: {tabId: [stackEntry]} where stackEntry = {screen, params}
- modalOpen: null | screenId
- sheetOpen: null | screenId
- formData: {}

### Screen fidelity
- Implement ALL screens specified in the plan as distinct views.
- Each screen must have: realistic seed data, empty state, at minimum one working interactive element.
- Lists: scrollable, tappable rows that push detail view. Use the plan's actual seed data items.
- Detail views: hero area, content sections, primary action button.
- Forms: working inputs that update formData. Submit button that pops back and shows a success toast.
- Settings screen with working toggle switches (update state).

### Animations & polish
- Spring-like animations: use cubic-bezier(0.34, 1.56, 0.64, 1) for entrances, ease-out for exits
- List item entrance: stagger 30ms per item, translateY(12px)→0 + opacity 0→1
- Tab switch: crossfade 150ms
- Pull-to-refresh simulation: show spinner on scroll-to-top
- Toast notifications: slide up from bottom, auto-dismiss after 2.5s
- Skeleton loading state: shimmer animation on initial render (300ms), then content fades in

### Typography
- Large Title: 34px 700 tracking -0.5px (collapsed: 17px 600 in nav bar)
- Title: 28px 700, Title2: 22px 700, Title3: 20px 600
- Body: 17px 400, Callout: 16px 400, Subhead: 15px 400, Footnote: 13px 400, Caption: 12px 400
- Use the plan's fontStyle: "rounded" → font-variant-numeric: tabular-nums + letter-spacing: -0.3px; "monospaced" → font-family: 'SF Mono', monospace for numbers

### Quality bar
- EVERY tap target must do something (navigate, open sheet, toggle, submit)
- NO placeholder text — use the actual seed data from the plan
- All screens reachable through the actual navigation flow described in the plan
- The app must feel alive on load: seed data visible immediately in the populated state
- Dark mode by default. Honor prefers-color-scheme for light mode.

Return ONLY the raw HTML document starting with <!DOCTYPE html>. No markdown fences, no commentary outside the HTML.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, appName, summary, plan } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // This endpoint runs with verify_jwt=false (anonymous-callable). To prevent
    // unauthenticated callers from forcing premium-provider spend, the preview
    // always uses Gemini regardless of any provider hint in the request body.
    const provider: Provider = "gemini";
    const apiKey = getApiKey(provider);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: `${provider} API key not configured on the server.` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a rich user message that incorporates the architect plan
    const planContext = plan
      ? `\n\n## Architect's Plan (authoritative — use this data exactly)\n\`\`\`json\n${JSON.stringify(plan, null, 2).slice(0, 8000)}\n\`\`\``
      : "";

    const designSystem = plan?.designSystem ?? {};
    const accentColor = designSystem.accentColorHex ?? plan?.accentColorHex ?? "#0A84FF";
    const backgroundPrimary = designSystem.backgroundPrimary ?? "#000000";
    const surfaceColor = designSystem.surfaceColor ?? "#1C1C1E";
    const cornerRadiusMedium = designSystem.cornerRadiusMedium ?? "16px";
    const cornerRadiusLarge = designSystem.cornerRadiusLarge ?? "28px";
    const fontStyle = designSystem.fontStyle ?? "default";
    const motionPersonality = designSystem.motionPersonality ?? "spring animations";

    const screenList = (plan?.screens as { name: string; purpose: string; emptyStateCopy?: string; primaryCTA?: string }[] ?? [])
      .map((s, i) => `${i + 1}. **${s.name}**: ${s.purpose}${s.emptyStateCopy ? ` | Empty: "${s.emptyStateCopy}"` : ""}${s.primaryCTA ? ` | CTA: "${s.primaryCTA}"` : ""}`)
      .join("\n");

    const userMessage = `Build an interactive HTML prototype for this iOS app.

App: **${appName ?? "(unnamed)"}**
Summary: ${summary ?? prompt}
Accent color: ${accentColor}
Background: ${backgroundPrimary}
Surface: ${surfaceColor}
Corner radius (medium): ${cornerRadiusMedium}, (large): ${cornerRadiusLarge}
Font style: ${fontStyle}
Motion: ${motionPersonality}

Screens to implement:
${screenList || "Infer screens from the concept."}

Original idea:
"""
${prompt}
"""
${planContext}

Requirements:
- Responsive layout for mobile (≤480px), tablet (481-900px), desktop (≥901px)
- Use the exact accent color ${accentColor} for all interactive and active elements
- Use the exact seed data from the plan — no generic placeholders
- Implement all ${(plan?.screens as unknown[])?.length ?? 4}+ screens with working navigation
- Every tap target must navigate, open a sheet, submit a form, or toggle something
- The app must look alive on first render with seed data visible
- Return ONLY the raw HTML starting with <!DOCTYPE html>`;

    let result;
    try {
      result = await callAI({
        provider,
        apiKey,
        model: DEFAULT_MODELS[provider].engineer,
        system: SYSTEM_PROMPT,
        userMessage,
        maxTokens: 32000,
      });
    } catch (e) {
      if (e instanceof AIError) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: e.status >= 400 && e.status < 600 ? e.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    let html = result.text ?? "";
    if (!html) {
      return new Response(JSON.stringify({ error: "AI did not return a preview." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip markdown fences if present
    html = html.trim();
    const fenceMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenceMatch) html = fenceMatch[1].trim();

    const doctypeIdx = html.toLowerCase().indexOf("<!doctype");
    if (doctypeIdx > 0) html = html.slice(doctypeIdx);

    if (!html.toLowerCase().includes("<html")) {
      return new Response(JSON.stringify({ error: "Preview content malformed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-app-preview error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
