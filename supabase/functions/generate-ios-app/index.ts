// Generates a complete SwiftUI Xcode project from a natural-language prompt
// Two-phase pipeline: (1) Architect plans the app, (2) Engineer ships full code.
// Supports streaming (SSE) and two AI backends: Gemini (default) + Claude Opus (Studio).
// Enforces per-user monthly quotas based on subscription plan.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------- PHASE 1: ARCHITECT ----------
const ARCHITECT_PROMPT = `You are a Staff iOS Product Architect. Given a one-line app idea, you produce a tight, opinionated product + technical plan that a senior engineer can implement without further questions.

Think like an Apple Design Award judge. Be specific. No filler.

You MUST call "emit_app_plan" exactly once with:
- appName (PascalCase Swift identifier)
- bundleId (reverse-DNS, lowercased)
- tagline (one sentence, evocative)
- signatureFeature (the single thing that makes this app unforgettable, in 1-2 sentences)
- accentColorHex (sRGB hex matching the concept's mood)
- visualPersonality (3-6 adjectives + 1 sentence on materials/typography vibe)
- screens: 4-6 screens, each with { name, purpose, keyComponents (array of concrete UI elements), interactions }
- dataModel: 2-5 SwiftData @Model entities with { name, fields ([{name, type, notes}]), relationships }
- frameworks: only Apple frameworks you will ACTUALLY wire up (e.g. Charts, WidgetKit, AppIntents, TipKit, MapKit, AVKit, HealthKit, StoreKit). Each entry: { name, usage }
- seedData: concrete sample records that make the first launch feel alive (describe 3-8 items)
- userJourneys: 2-3 happy-path flows in 3-5 steps each
- delightMoments: 3-5 specific micro-interactions (haptics, symbol effects, transitions)

Be concrete. "Cards with stats" is bad. "Glassmorphic card with large SF Pro Rounded number, 12pt label below, subtle radial highlight on tap with .sensoryFeedback(.success)" is good.`;

// ---------- PHASE 2: ENGINEER ----------
const ENGINEER_PROMPT = `You are a Principal iOS Engineer + Product Designer shipping production-grade SwiftUI apps for Xcode 16+ targeting iOS 18+ (2026). Your output gets shortlisted for Apple Design Awards.

# Engineering bar (non-negotiable)
- Pure SwiftUI. @main App struct. UIKit only via UIViewRepresentable when SwiftUI cannot do it.
- Swift 6 strict concurrency. @Observable (NEVER ObservableObject). @MainActor on UI types. Sendable models. async/await + structured concurrency.
- State: @State, @Bindable, @Environment. Persistence: SwiftData (@Model, @Query, ModelContainer). NEVER CoreData.
- Navigation: NavigationStack + value-based .navigationDestination(for:). NEVER NavigationView.
- Networking: URLSession + async/await + Codable, wrapped in a typed Service with a protocol for previewing.
- Errors: typed Error enums with LocalizedError + recovery suggestions. NEVER fatalError in production paths.
- Accessibility: labels, hints, traits, Dynamic Type up to AX5, reduce-motion respect, WCAG-AA contrast, VoiceOver rotor where useful.
- Theming: semantic colors + Asset Catalog AccentColor. Light + Dark perfect. Tasteful .ultraThinMaterial, layered gradients, SF Symbols 6 with .symbolEffect.
- Motion: spring animations (.snappy, .bouncy), matchedGeometryEffect, .sensoryFeedback for haptics. Purposeful, never gratuitous.
- Empty / loading / error / offline states for every async surface. Skeletons or shimmer where appropriate.
- Privacy: declare every Info.plist usage description in project.yml.

# Architecture
- Tree: App/, Features/<Feature>/{Views,Models,Stores}, Core/{Services,Extensions,Components,Theme}, Resources/.
- ONE type per file. Extract subviews aggressively (no view body > ~80 lines). No god-views.
- Theme.swift owns spacing, radii, typography, semantic color helpers.
- Reusable Core/Components: GlassCard, StatTile, SectionHeader, etc. Use them across features.
- Every #Preview uses an in-memory ModelContainer with the seed data so previews look real.

# Visual quality
- Every screen is a designed surface: hero, header, content, empty state. No "Hello World" tabs.
- Use Swift Charts for any data viz with custom marks, annotations, and accessible descriptions.
- Use TipKit for first-run guidance when sensible. Use AppIntents/Shortcuts/WidgetKit only when they materially extend the concept — and wire them end-to-end.
- Microcopy is warm, specific, on-brand. No "Lorem ipsum", no "Item 1".

# Output contract — CRITICAL
Call "emit_xcode_project" exactly once. Files must be COMPLETE — no "// ...", no TODO stubs in core paths, no truncation. Every Swift file must compile under Swift 6 strict concurrency in a fresh Xcode 16 project.

Mandatory files:
- README.md — what was built, screen list, signature feature, Xcode 16 + \`xcodegen generate\` instructions, any post-install notes.
- project.yml — XcodeGen spec: iOS app target, bundleId, deployment iOS 18.0, Swift 6 (SWIFT_VERSION = 6.0, SWIFT_STRICT_CONCURRENCY = complete), SwiftUI lifecycle, all Info.plist usage strings, entitlements when needed.
- Sources/<AppName>App.swift — @main entry, ModelContainer setup, scene config, optional onboarding routing.
- Sources/ContentView.swift — top-level TabView or NavigationStack root.
- Sources/Core/Theme.swift — color/spacing/typography/radius/shadow tokens.
- Sources/Core/Components/*.swift — at least 2-3 reusable components.
- Sources/Features/<Feature>/**.swift — multiple feature views, @Observable stores, @Model types. Real logic, real layouts, real seed data.
- Sources/Resources/Assets.xcassets/{Contents.json, AppIcon.appiconset/Contents.json, AccentColor.colorset/Contents.json}
- .gitignore — standard Xcode.

# Quality floor
- 16-24 source files. NEVER fewer than 12.
- The app MUST be usable end-to-end on first launch: seeded data, working CRUD or core flow, working navigation, working settings/preferences screen.
- No placeholder image assets — use SF Symbols + tasteful gradients/shapes.
- Every async path has loading, empty, and error UI.

You will be given the architect's plan. Execute it faithfully. If the plan has a gap, infer the most delightful interpretation and document the assumption in README.`;

const TOOL_PLAN = {
  type: "function",
  function: {
    name: "emit_app_plan",
    description: "Emit the structured product + technical plan.",
    parameters: {
      type: "object",
      properties: {
        appName: { type: "string" },
        bundleId: { type: "string" },
        tagline: { type: "string" },
        signatureFeature: { type: "string" },
        accentColorHex: { type: "string" },
        visualPersonality: { type: "string" },
        screens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              purpose: { type: "string" },
              keyComponents: { type: "array", items: { type: "string" } },
              interactions: { type: "string" },
            },
            required: ["name", "purpose", "keyComponents", "interactions"],
            additionalProperties: false,
          },
        },
        dataModel: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["name", "type"],
                  additionalProperties: false,
                },
              },
              relationships: { type: "string" },
            },
            required: ["name", "fields"],
            additionalProperties: false,
          },
        },
        frameworks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              usage: { type: "string" },
            },
            required: ["name", "usage"],
            additionalProperties: false,
          },
        },
        seedData: { type: "string" },
        userJourneys: { type: "array", items: { type: "string" } },
        delightMoments: { type: "array", items: { type: "string" } },
      },
      required: [
        "appName", "bundleId", "tagline", "signatureFeature", "accentColorHex",
        "visualPersonality", "screens", "dataModel", "frameworks", "seedData",
        "userJourneys", "delightMoments",
      ],
      additionalProperties: false,
    },
  },
};

const TOOL_PROJECT = {
  type: "function",
  function: {
    name: "emit_xcode_project",
    description: "Emit the complete Xcode project file tree.",
    parameters: {
      type: "object",
      properties: {
        appName: { type: "string" },
        bundleId: { type: "string" },
        summary: { type: "string", description: "2-4 sentence description of what was built." },
        files: {
          type: "array",
          description: "All project files (16-24). Path is relative to project root. Content must be complete.",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" },
            },
            required: ["path", "content"],
            additionalProperties: false,
          },
        },
      },
      required: ["appName", "bundleId", "summary", "files"],
      additionalProperties: false,
    },
  },
};

// -------- SSE helpers --------
function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

// -------- Quota enforcement --------
const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 30,
  studio: Infinity,
};

async function checkQuota(supabase: ReturnType<typeof createClient>, userId: string): Promise<{ allowed: boolean; plan: string; used: number; limit: number }> {
  const { data: planData } = await supabase.rpc("get_user_plan", { p_user_id: userId });
  const { data: usedData } = await supabase.rpc("count_monthly_generations", { p_user_id: userId });
  const plan = (planData as string) ?? "free";
  const used = (usedData as number) ?? 0;
  const limit = PLAN_LIMITS[plan] ?? 3;
  return { allowed: used < limit, plan, used, limit };
}

// -------- Gemini gateway call --------
async function callGateway(body: unknown, apiKey: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function gatewayError(status: number): string {
  if (status === 429) return "Rate limit reached. Please wait a moment and try again.";
  if (status === 402) return "AI credits exhausted. Add credits in Lovable workspace settings.";
  return "AI generation failed.";
}

function validateProject(project: unknown): string | null {
  if (!project || typeof project !== "object") return "Invalid project payload.";
  const p = project as { files?: unknown[] };
  if (!Array.isArray(p.files) || p.files.length < 12) {
    return "AI returned an incomplete project (need 12+ files). Try again.";
  }
  const paths = new Set<string>((p.files as { path: string }[]).map((f) => f.path));
  for (const r of ["README.md", "project.yml", ".gitignore"]) {
    if (!paths.has(r)) return `Missing required file: ${r}`;
  }
  const hasAppEntry = [...paths].some((p) => /Sources\/.*App\.swift$/.test(p));
  const hasContentView = [...paths].some((p) => p.endsWith("Sources/ContentView.swift"));
  const hasTheme = [...paths].some((p) => p.endsWith("Theme.swift"));
  if (!hasAppEntry) return "Missing @main App entry file.";
  if (!hasContentView) return "Missing ContentView.swift.";
  if (!hasTheme) return "Missing Core/Theme.swift.";
  for (const f of p.files as { path: string; content: string }[]) {
    if (typeof f.content !== "string" || f.content.length < 20) {
      return `File ${f.path} is empty or too short.`;
    }
    if (/\/\/\s*\.\.\.\s*(rest of|TODO|truncated)/i.test(f.content)) {
      return `File ${f.path} contains a truncation marker.`;
    }
  }
  return null;
}

// -------- Claude Opus generation --------
async function generateWithClaude(prompt: string, anthropicKey: string, encoder: TextEncoder, controller: ReadableStreamDefaultController) {
  // Phase 1: Architect via Claude (uses Haiku for speed)
  controller.enqueue(encoder.encode(sseEvent("progress", { phase: "analyzing", message: "[claude] architect phase — designing app structure…", percent: 20 })));

  const architectResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: [
        { type: "text", text: ARCHITECT_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [TOOL_PLAN.function],
      tool_choice: { type: "tool", name: "emit_app_plan" },
      messages: [{ role: "user", content: `App idea:\n"""\n${prompt}\n"""\n\nProduce the plan now.` }],
    }),
  });

  if (!architectResp.ok) {
    const t = await architectResp.text();
    throw new Error(`Architect phase failed (${architectResp.status}): ${t.slice(0, 200)}`);
  }

  const architectData = await architectResp.json();
  const planBlock = architectData.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!planBlock?.input) throw new Error("Claude architect did not return a plan.");
  const plan = planBlock.input;

  controller.enqueue(encoder.encode(sseEvent("progress", { phase: "generating", message: "[claude] engineer phase — writing Swift 6 project…", percent: 50 })));

  // Phase 2: Engineer via Claude Opus
  const planForEngineer = JSON.stringify(plan, null, 2);
  const engineerUserMsg = `Original user idea:\n"""\n${prompt}\n"""\n\nArchitect's plan (authoritative — implement faithfully):\n\`\`\`json\n${planForEngineer}\n\`\`\`\n\nShip the complete Xcode project. 16-24 real, complete files. No stubs.`;

  const engineerResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 32000,
      system: [
        { type: "text", text: ENGINEER_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [TOOL_PROJECT.function],
      tool_choice: { type: "tool", name: "emit_xcode_project" },
      messages: [{ role: "user", content: engineerUserMsg }],
    }),
  });

  if (!engineerResp.ok) {
    const t = await engineerResp.text();
    throw new Error(`Engineer phase failed (${engineerResp.status}): ${t.slice(0, 200)}`);
  }

  const engineerData = await engineerResp.json();
  const projectBlock = engineerData.content?.find((b: { type: string }) => b.type === "tool_use");
  if (!projectBlock?.input) throw new Error("Claude did not return a project.");
  return { project: projectBlock.input, plan };
}

// -------- Gemini generation --------
async function generateWithGemini(prompt: string, lovableKey: string, encoder: TextEncoder, controller: ReadableStreamDefaultController) {
  controller.enqueue(encoder.encode(sseEvent("progress", { phase: "analyzing", message: "[agent] booting planner · model=gemini-2.5-flash", percent: 15 })));

  const planResp = await callGateway({
    model: "google/gemini-2.5-flash",
    max_tokens: 4000,
    messages: [
      { role: "system", content: ARCHITECT_PROMPT },
      { role: "user", content: `App idea:\n"""\n${prompt}\n"""\n\nProduce the plan now.` },
    ],
    tools: [TOOL_PLAN],
    tool_choice: { type: "function", function: { name: "emit_app_plan" } },
  }, lovableKey);

  if (!planResp.ok) {
    throw new Error(gatewayError(planResp.status));
  }

  const planData = await planResp.json();
  const planCall = planData?.choices?.[0]?.message?.tool_calls?.[0];
  if (!planCall?.function?.arguments) throw new Error("Architect did not return a plan.");
  const plan = JSON.parse(planCall.function.arguments);

  controller.enqueue(encoder.encode(sseEvent("progress", { phase: "generating", message: `[plan] ${plan.appName} · ${plan.screens?.length ?? 0} screens · engineer starting…`, percent: 40 })));

  const planForEngineer = JSON.stringify(plan, null, 2);
  const engineerUserMsg = `Original user idea:\n"""\n${prompt}\n"""\n\nArchitect's plan (authoritative — implement faithfully):\n\`\`\`json\n${planForEngineer}\n\`\`\`\n\nNow ship the complete Xcode project. 16-24 real, complete files. No stubs. The app must build under Swift 6 strict concurrency, run on iOS 18, navigate, persist via SwiftData, and feel polished on first launch with the seeded data described in the plan.\n\nUse the accent color from the plan in AccentColor.colorset/Contents.json. Wire up every framework listed. Implement every screen described. Hit every delight moment.`;

  const buildResp = await callGateway({
    model: "google/gemini-2.5-pro",
    max_tokens: 32000,
    messages: [
      { role: "system", content: ENGINEER_PROMPT },
      { role: "user", content: engineerUserMsg },
    ],
    tools: [TOOL_PROJECT],
    tool_choice: { type: "function", function: { name: "emit_xcode_project" } },
  }, lovableKey);

  if (!buildResp.ok) {
    throw new Error(gatewayError(buildResp.status));
  }

  const buildData = await buildResp.json();
  const toolCall = buildData?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("AI did not return a project.");
  return { project: JSON.parse(toolCall.function.arguments), plan };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  let userId: string | null = null;
  let userPlan = "free";

  // Auth check (optional — anon users get free quota tracked differently)
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    try {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* non-fatal */ }
  }

  const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Quota enforcement for logged-in users
  if (userId) {
    const quota = await checkQuota(adminSupabase, userId);
    userPlan = quota.plan;
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({ error: `Monthly limit reached (${quota.used}/${quota.limit} builds). Upgrade your plan at /pricing.` }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  let body: { prompt?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { prompt, model = "gemini-pro" } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return new Response(
      JSON.stringify({ error: "Please describe the app you want to build (min 5 chars)." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Studio-only: Claude model
  if (model === "claude-opus" && userPlan !== "studio") {
    return new Response(
      JSON.stringify({ error: "Claude Opus is available on the Studio plan. Upgrade at /pricing." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Stream the response via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sseEvent("progress", { phase: "analyzing", message: "> prompt received — initializing pipeline…", percent: 5 })));

        let project: unknown;
        let plan: unknown;
        const modelUsed = model === "claude-opus" ? "claude-opus-4-7" : "gemini-2.5-pro";

        if (model === "claude-opus" && ANTHROPIC_API_KEY) {
          ({ project, plan } = await generateWithClaude(prompt, ANTHROPIC_API_KEY, encoder, controller));
        } else {
          if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured.");
          ({ project, plan } = await generateWithGemini(prompt, LOVABLE_API_KEY, encoder, controller));
        }

        controller.enqueue(encoder.encode(sseEvent("progress", { phase: "bundling", message: "[bundler] validating project structure…", percent: 85 })));

        const validationError = validateProject(project);
        if (validationError) throw new Error(validationError);

        (project as Record<string, unknown>).plan = plan;

        // Persist generation to DB
        if (userId) {
          const p = project as { appName?: string; bundleId?: string; summary?: string; files?: unknown[] };
          await adminSupabase.from("generations").insert({
            user_id: userId,
            prompt,
            app_name: p.appName,
            bundle_id: p.bundleId,
            summary: p.summary,
            files: p.files,
            files_count: p.files?.length ?? 0,
            status: "success",
            model_used: modelUsed,
            cost_usd: model === "claude-opus" ? 0.12 : 0.08,
          });
        }

        controller.enqueue(encoder.encode(sseEvent("progress", { phase: "done", message: "[done] project ready", percent: 100 })));
        controller.enqueue(encoder.encode(sseEvent("result", { project })));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("generate-ios-app error:", msg);

        // Record failed generation
        if (userId) {
          await adminSupabase.from("generations").insert({
            user_id: userId,
            prompt,
            status: "failed",
            model_used: model === "claude-opus" ? "claude-opus-4-7" : "gemini-2.5-pro",
          });
        }

        controller.enqueue(encoder.encode(sseEvent("error", { message: msg })));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});
