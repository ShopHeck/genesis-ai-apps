// Generates a complete SwiftUI Xcode project from a natural-language prompt
// Two-phase pipeline: (1) Architect plans the app, (2) Engineer ships full code.
// Returns JSON: { appName, bundleId, files: [{path, content}], summary, plan }

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

async function callGateway(body: unknown, apiKey: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return resp;
}

function gatewayErrorResponse(status: number) {
  if (status === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (status === 402) {
    return new Response(
      JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace settings." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({ error: "AI generation failed." }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateProject(project: any): string | null {
  if (!project || typeof project !== "object") return "Invalid project payload.";
  if (!Array.isArray(project.files) || project.files.length < 12) {
    return "AI returned an incomplete project (need 12+ files). Try again.";
  }
  const paths = new Set<string>(project.files.map((f: any) => f.path));
  const required = [
    "README.md",
    "project.yml",
    ".gitignore",
  ];
  for (const r of required) {
    if (!paths.has(r)) return `Missing required file: ${r}`;
  }
  const hasAppEntry = [...paths].some((p) => /Sources\/.*App\.swift$/.test(p));
  const hasContentView = [...paths].some((p) => p.endsWith("Sources/ContentView.swift"));
  const hasTheme = [...paths].some((p) => p.endsWith("Theme.swift"));
  if (!hasAppEntry) return "Missing @main App entry file.";
  if (!hasContentView) return "Missing ContentView.swift.";
  if (!hasTheme) return "Missing Core/Theme.swift.";
  // Reject obvious truncation
  for (const f of project.files) {
    if (typeof f.content !== "string" || f.content.length < 20) {
      return `File ${f.path} is empty or too short.`;
    }
    if (/\/\/\s*\.\.\.\s*(rest of|TODO|truncated)/i.test(f.content)) {
      return `File ${f.path} contains a truncation marker.`;
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Please describe the app you want to build (min 5 chars)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- PHASE 1: Architect plan --------
    const planResp = await callGateway({
      model: "google/gemini-2.5-flash",
      max_tokens: 4000,
      messages: [
        { role: "system", content: ARCHITECT_PROMPT },
        { role: "user", content: `App idea:\n"""\n${prompt}\n"""\n\nProduce the plan now.` },
      ],
      tools: [TOOL_PLAN],
      tool_choice: { type: "function", function: { name: "emit_app_plan" } },
    }, LOVABLE_API_KEY);

    if (!planResp.ok) {
      const t = await planResp.text();
      console.error("Architect phase failed", planResp.status, t.slice(0, 500));
      return gatewayErrorResponse(planResp.status);
    }

    const planData = await planResp.json();
    const planCall = planData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!planCall?.function?.arguments) {
      console.error("No plan returned", JSON.stringify(planData).slice(0, 800));
      return new Response(JSON.stringify({ error: "Architect did not return a plan." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let plan: any;
    try {
      plan = JSON.parse(planCall.function.arguments);
    } catch (e) {
      console.error("Plan JSON parse error", e);
      return new Response(JSON.stringify({ error: "Invalid plan JSON from architect." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- PHASE 2: Engineer build --------
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
    }, LOVABLE_API_KEY);

    if (!buildResp.ok) {
      const t = await buildResp.text();
      console.error("Engineer phase failed", buildResp.status, t.slice(0, 500));
      return gatewayErrorResponse(buildResp.status);
    }

    const buildData = await buildResp.json();
    const toolCall = buildData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No project tool call", JSON.stringify(buildData).slice(0, 800));
      return new Response(JSON.stringify({ error: "AI did not return a project." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let project: any;
    try {
      project = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Project JSON parse error", e);
      return new Response(JSON.stringify({ error: "Invalid project JSON from AI." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validationError = validateProject(project);
    if (validationError) {
      console.error("Validation failed:", validationError);
      return new Response(
        JSON.stringify({ error: validationError, plan }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    project.plan = plan;

    return new Response(JSON.stringify(project), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ios-app error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
