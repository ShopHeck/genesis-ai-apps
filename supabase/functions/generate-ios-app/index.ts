// Generates a complete SwiftUI Xcode project from a natural-language prompt
// Returns JSON: { appName, bundleId, files: [{path, content}], summary }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a Principal iOS Engineer + Product Designer crafting production-grade SwiftUI apps for Xcode 16+ targeting iOS 18+ (2026 best practices). You ship apps that feel like they belong on Apple Design Award shortlists.

# Engineering bar (non-negotiable)
- Pure SwiftUI. App lifecycle via @main App struct. No UIKit unless strictly required (e.g. UIViewRepresentable for a missing capability).
- Swift 6 strict concurrency. Use @Observable (NOT ObservableObject), @MainActor on UI types, Sendable models, structured concurrency (async/await, Task, TaskGroup).
- State: @State, @Bindable, @Environment. Persistence: SwiftData (@Model, @Query, ModelContainer). NEVER CoreData.
- Navigation: NavigationStack with value-based .navigationDestination(for:). NEVER NavigationView.
- Networking (if needed): URLSession + async/await + Codable. Wrap in a small typed Service.
- Errors: typed Error enums + user-facing recovery suggestions. No fatalError in production paths.
- Accessibility: labels, hints, traits, Dynamic Type, reduce-motion respect, color-contrast safe, VoiceOver rotor where useful.
- Theming: semantic colors (Color.primary, Color(.systemBackground)) + Asset Catalog AccentColor. Light + Dark perfect. Tasteful use of .ultraThinMaterial, gradients, SF Symbols 6 (with .symbolEffect when delightful).
- Motion: subtle spring animations, matchedGeometryEffect, .sensoryFeedback for haptics. Never gratuitous.
- Empty / loading / error states for every async surface.
- Privacy: add Info.plist usage descriptions in project.yml when features need them (camera, location, health, etc.).

# Architecture
- Modular tree: App/, Features/<Feature>/Views, Features/<Feature>/Models, Features/<Feature>/Stores (@Observable), Core/Services, Core/Extensions, Resources/.
- One type per file. Small, composable views. Extract subviews aggressively. Pull magic numbers into a Theme/Spacing.swift.
- Seed sample data in a #Preview using ModelContainer(for:..., configurations: .init(isStoredInMemoryOnly: true)) so previews are rich.

# Visual quality
- Treat every screen as a real product surface. Bespoke iconography via SF Symbols, layered cards, generous spacing, distinctive empty states, charming microcopy.
- Use Swift Charts for any data viz. Use TipKit when onboarding makes sense. Use WidgetKit / Live Activities / App Intents / Shortcuts when they meaningfully extend the idea — and actually wire them up.
- For each major screen, design a real layout (header, hero, list, detail, settings). No stub "Hello World" tabs.

# Output contract
You MUST call the function "emit_xcode_project" exactly once with the full file list. Do NOT include binary files.

Required files (minimum):
- README.md — what was built, screen list, build/run instructions for Xcode 16+ AND \`xcodegen generate\`, and any post-install notes.
- project.yml — XcodeGen spec: iOS app target, bundleId, deployment iOS 18.0, Swift 6, SwiftUI lifecycle, Info.plist keys (NSCameraUsageDescription etc. when needed), entitlements when needed.
- Sources/<AppName>App.swift — @main entry, ModelContainer setup, scene config.
- Sources/ContentView.swift — top-level navigation (TabView or NavigationStack root).
- Sources/Features/.../*.swift — multiple feature views, @Observable stores, @Model types. Real logic, real layouts.
- Sources/Core/Theme.swift — colors, spacing, typography tokens.
- Sources/Resources/Assets.xcassets/Contents.json
- Sources/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json
- Sources/Resources/Assets.xcassets/AccentColor.colorset/Contents.json (with a tasteful sRGB color matching the app concept)
- .gitignore — Xcode standard.

# Quality floor
- Aim for 14–22 source files. NEVER fewer than 10.
- Every file must be COMPLETE — no "// ... rest of code", no TODO stubs in core paths.
- Code must compile cleanly under Swift 6 strict concurrency in a fresh Xcode 16 project.
- The app must be genuinely usable end-to-end on first launch: seed data, working CRUD or core flow, working navigation, working settings.

If the user's idea is vague, infer the most delightful interpretation and document your assumptions in the README.`;

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

    const tools = [
      {
        type: "function",
        function: {
          name: "emit_xcode_project",
          description: "Emit the complete Xcode project file tree.",
          parameters: {
            type: "object",
            properties: {
              appName: {
                type: "string",
                description: "PascalCase Swift-safe app name, e.g. 'TaskFlow'",
              },
              bundleId: {
                type: "string",
                description: "Reverse-DNS bundle identifier, e.g. 'com.example.taskflow'",
              },
              summary: {
                type: "string",
                description: "2-4 sentence description of what was built, key screens, and signature feature.",
              },
              files: {
                type: "array",
                description: "All project files (14-22). Path is relative to project root.",
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
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        max_tokens: 32000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `App idea:\n\n"""\n${prompt}\n"""\n\nDesign and ship a complete, production-quality SwiftUI iOS app.\n\nBefore writing code, plan silently:\n1. The signature feature that makes this app feel "Apple Design Award worthy".\n2. The 3-5 core screens and their navigation graph.\n3. The @Model SwiftData schema (entities + relationships).\n4. Which Apple frameworks elevate the experience (Charts, WidgetKit, Live Activities, App Intents, TipKit, HealthKit, MapKit, AVKit, etc.) — only include ones you will actually wire up.\n5. The accent color + visual personality.\n\nThen emit 14-22 real, complete files. No stubs. The app must run, navigate, persist, and feel polished on first launch with seeded sample data.`,
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "emit_xcode_project" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
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

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response", JSON.stringify(data).slice(0, 1000));
      return new Response(JSON.stringify({ error: "AI did not return a project." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let project;
    try {
      project = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("JSON parse error", e);
      return new Response(JSON.stringify({ error: "Invalid project JSON from AI." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(project?.files) || project.files.length < 8) {
      return new Response(
        JSON.stringify({ error: "AI returned an incomplete project. Try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
