// Generates a complete SwiftUI Xcode project from a natural-language prompt
// Returns JSON: { appName, bundleId, files: [{path, content}], summary }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert iOS engineer specializing in production-grade SwiftUI apps for Xcode 16+ (2026 best practices), targeting iOS 18+.

You generate COMPLETE, COMPILABLE app source files based on the user's app idea. You MUST follow Apple's latest best practices:

- Pure SwiftUI (no UIKit unless strictly necessary), App lifecycle with @main App struct
- Swift 6 concurrency: @Observable macro for view models (NOT ObservableObject), @MainActor where appropriate
- @Environment, @State, @Bindable, @Observable. Use SwiftData (@Model) for persistence when relevant — NOT CoreData
- NavigationStack (NOT NavigationView), .navigationDestination, value-based navigation
- Localizable strings via String Catalog references (just use String literals, the catalog handles them)
- Accessibility labels/hints on interactive elements, Dynamic Type friendly
- Dark mode + light mode automatic via semantic colors (Color.primary, Color(.systemBackground), or Asset Catalog colors)
- App Icon and Accent Color references in Assets.xcassets (you only generate Contents.json placeholders, no binary images)
- Privacy: Info.plist usage descriptions when features need them
- Modular file structure: App/, Features/<Feature>/Views, Features/<Feature>/Models, Core/, Resources/
- No third-party SPM dependencies unless absolutely required
- Production polish: empty states, loading states, error handling, haptics where appropriate

You MUST call the function "emit_xcode_project" exactly once with the full file list. Do NOT include the binary .xcodeproj file content — emit a project.yml (XcodeGen spec) at the repo root so the user can run \`xcodegen generate\` OR open the folder in Xcode 16+ which can also use Swift Package manifest. Also emit a README.md with build instructions.

Required files at minimum:
- README.md (build instructions: open in Xcode 16+, or run xcodegen)
- project.yml (XcodeGen spec defining the iOS app target, bundle id, deployment target iOS 18.0, Swift 6, SwiftUI lifecycle)
- Sources/<AppName>App.swift (the @main entry)
- Sources/ContentView.swift
- Multiple feature view + model files based on the app idea
- Sources/Resources/Info.plist (only if custom keys needed; otherwise let project.yml generate it — prefer omitting)
- Sources/Assets.xcassets/Contents.json
- Sources/Assets.xcassets/AppIcon.appiconset/Contents.json
- Sources/Assets.xcassets/AccentColor.colorset/Contents.json
- .gitignore (Xcode standard)

All file content must be the FULL contents of that file as a string. No placeholders like "// ... rest of code". Generate real, complete, working Swift code.`;

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
                description: "1-2 sentence description of what was built and key features.",
              },
              files: {
                type: "array",
                description: "All project files. Path is relative to project root.",
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
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Generate a complete, production-quality SwiftUI iOS app for this idea:\n\n"""\n${prompt}\n"""\n\nReturn at least 8-15 source files with real, working logic for the core features. Make it App-Store-ready in code quality.`,
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
