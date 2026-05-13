// Generates a complete SwiftUI Xcode project from a natural-language prompt.
// Four/Five-phase pipeline:
//   1. Architect   — plan + design system + acceptance criteria (Haiku/Flash)
//   2. Designer    — per-screen spec (Haiku, Claude path only)
//   3. Engineer    — full Swift 6 source code (Opus/Gemini-Pro)
//   4. Reviewer    — quality gate against acceptance criteria (Haiku/Flash)
//   5. Refiner     — targeted patch for blocker issues (Opus/Gemini-Pro, max 1×)
// Supports streaming (SSE) and two AI backends: Gemini (default) + Claude (Studio).
// Enforces per-user monthly quotas based on subscription plan.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────
// PHASE 1: ARCHITECT
// ─────────────────────────────────────────────────────────────
const ARCHITECT_PROMPT = `You are a Staff iOS Product Architect. Given a one-line app idea, you produce a tight, opinionated product + technical plan that a senior engineer can implement without further questions.

Think like an Apple Design Award judge. Be specific. No filler.

You MUST call "emit_app_plan" exactly once with:
- appName (PascalCase Swift identifier)
- bundleId (reverse-DNS, lowercased)
- tagline (one sentence, evocative)
- signatureFeature (the single thing that makes this app unforgettable, in 1-2 sentences)
- accentColorHex (sRGB hex matching the concept's mood)
- visualPersonality (3-6 adjectives + 1 sentence on materials/typography vibe)
- designSystem: design tokens the engineer MUST implement exactly
  - accentColorHex: same as above
  - backgroundPrimary, backgroundSecondary, surfaceColor: hex values for the layered dark-mode background stack
  - textPrimary, textSecondary: hex values
  - cornerRadiusSmall (4-8pt), cornerRadiusMedium (12-16pt), cornerRadiusLarge (24-32pt)
  - fontStyle: "rounded" | "serif" | "monospaced" | "default" (maps to SF Pro variants)
  - spacingUnit: base grid spacing in pt (e.g. "8")
  - motionPersonality: one sentence — e.g. "spring(response:0.38,damping:0.7) everywhere, never ease-in-out"
- screens: 4-6 screens, each with { name, purpose, keyComponents (array of concrete UI elements), interactions, emptyStateCopy, primaryCTA }
- dataModel: 2-5 SwiftData @Model entities with { name, fields ([{name, type, notes}]), relationships }
- frameworks: only Apple frameworks you will ACTUALLY wire up. Each entry: { name, usage }
- seedData: concrete sample records that make the first launch feel alive (describe 5-10 items with real names/values)
- userJourneys: 2-3 happy-path flows in 3-5 steps each
- delightMoments: 4-6 specific micro-interactions (haptics, symbol effects, transitions, sounds)
- acceptanceCriteria: 6-10 concrete, testable quality gates, e.g.:
  - "Every screen has a non-empty populated state with ≥3 seed data items visible"
  - "Theme.swift exports accentColor matching #XXXXXX exactly"
  - "All primary action buttons trigger .sensoryFeedback(.success)"
  - "No file contains '// TODO', 'Lorem ipsum', or 'placeholder'"

Be concrete. "Cards with stats" is bad. "Glassmorphic card with large SF Pro Rounded number, 12pt label below, subtle radial highlight on tap with .sensoryFeedback(.success)" is good.`;

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
        designSystem: {
          type: "object",
          properties: {
            accentColorHex: { type: "string" },
            backgroundPrimary: { type: "string" },
            backgroundSecondary: { type: "string" },
            surfaceColor: { type: "string" },
            textPrimary: { type: "string" },
            textSecondary: { type: "string" },
            cornerRadiusSmall: { type: "string" },
            cornerRadiusMedium: { type: "string" },
            cornerRadiusLarge: { type: "string" },
            fontStyle: { type: "string" },
            spacingUnit: { type: "string" },
            motionPersonality: { type: "string" },
          },
          required: ["accentColorHex", "backgroundPrimary", "surfaceColor", "fontStyle", "motionPersonality"],
          additionalProperties: false,
        },
        screens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              purpose: { type: "string" },
              keyComponents: { type: "array", items: { type: "string" } },
              interactions: { type: "string" },
              emptyStateCopy: { type: "string" },
              primaryCTA: { type: "string" },
            },
            required: ["name", "purpose", "keyComponents", "interactions", "emptyStateCopy", "primaryCTA"],
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
        acceptanceCriteria: { type: "array", items: { type: "string" } },
      },
      required: [
        "appName", "bundleId", "tagline", "signatureFeature", "accentColorHex",
        "visualPersonality", "designSystem", "screens", "dataModel", "frameworks",
        "seedData", "userJourneys", "delightMoments", "acceptanceCriteria",
      ],
      additionalProperties: false,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// PHASE 2: DESIGNER (Claude path only)
// ─────────────────────────────────────────────────────────────
const DESIGNER_PROMPT = `You are a Senior Product Designer who has shipped Apple Design Award-winning iOS apps. You bridge the gap between an architect's plan and the engineer's implementation by producing a precise, implementation-ready design specification.

Given the architect's plan, produce a detailed per-screen specification. Your output guides the engineer on exactly what to build visually — down to specific SwiftUI modifiers, copy, and states.

Call "emit_design_spec" exactly once.

For each screen, describe:
- componentHierarchy: the SwiftUI view tree in pseudo-code (e.g. "ZStack > ScrollView > LazyVStack > ItemCard(title:, subtitle:, badge:) × N")
- emptyState: specific copy ("Start by adding your first..."), specific icon/illustration (SF Symbol name or shape description), specific CTA text
- loadingState: "shimmer skeleton with 3 placeholder rows" or "progressive blur + opacity 0.4 on stale content"
- populatedState: 2-3 concrete example rows using the seed data verbatim
- errorState: specific error title, body, and recovery button label
- animations: list specific SwiftUI animations (e.g. ".transition(.asymmetric(insertion: .move(edge:.bottom).combined(with:.opacity), removal: .opacity))")
- copy: dict of every UI string — buttons, placeholders, section headers, tooltips

For the navigation flow, describe the exact NavigationStack + TabView structure including value types for .navigationDestination(for:).

For signature moments, describe the exact code-level implementation of the 2-3 most memorable interactions.`;

const TOOL_DESIGN = {
  type: "function",
  function: {
    name: "emit_design_spec",
    description: "Emit the per-screen design specification.",
    parameters: {
      type: "object",
      properties: {
        navigationStructure: { type: "string" },
        screenSpecs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              componentHierarchy: { type: "string" },
              emptyState: { type: "string" },
              loadingState: { type: "string" },
              populatedState: { type: "string" },
              errorState: { type: "string" },
              animations: { type: "array", items: { type: "string" } },
              copy: { type: "object", additionalProperties: { type: "string" } },
            },
            required: ["name", "componentHierarchy", "emptyState", "populatedState"],
            additionalProperties: false,
          },
        },
        signatureMoments: { type: "array", items: { type: "string" } },
      },
      required: ["navigationStructure", "screenSpecs", "signatureMoments"],
      additionalProperties: false,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// PHASE 3: ENGINEER
// ─────────────────────────────────────────────────────────────
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

# Studio quality bar — think Things 3, Linear, Bear, Streaks
Anti-patterns that will fail this bar:
- Default SystemGroupedBackground list cells without any customization
- Plain NavigationBarTitle with no custom font or color
- SF symbols tinted only in system blue
- "Item 1", "Item 2" or "Lorem ipsum" anywhere in the output
- Empty states that just say "No items yet" with no illustration and no CTA
- Missing haptic feedback on primary actions (like saving, completing, deleting)
- No loading states — every async operation needs skeleton or shimmer
- Buttons without any visual feedback or .sensoryFeedback
- Identical card layouts across different screens — each screen must have a distinct visual identity

# Visual quality
- Every screen is a designed surface: hero, header, content zone, empty state. No generic tab bars.
- Custom typography ramp using Font.custom or .fontDesign modifier to match the app's personality.
- At least 2 distinctive screen transitions (matchedGeometryEffect, .zoom, custom move+opacity).
- Swift Charts for any data viz: custom marks, gradient fills, accessible descriptions.
- TipKit for contextual first-run hints. AppIntents/Shortcuts if concept materially benefits.
- Microcopy is warm, specific, on-brand. No generic filler.

# Output contract — CRITICAL
Call "emit_xcode_project" exactly once. Files must be COMPLETE — no "// ...", no TODO stubs in core paths, no truncation. Every Swift file must compile under Swift 6 strict concurrency in a fresh Xcode 16 project.

Mandatory files:
- README.md — what was built, screen list, signature feature, Xcode 16 + \`xcodegen generate\` instructions, any post-install notes.
- project.yml — XcodeGen spec: iOS app target, bundleId, deployment iOS 18.0, Swift 6 (SWIFT_VERSION = 6.0, SWIFT_STRICT_CONCURRENCY = complete), SwiftUI lifecycle, all Info.plist usage strings, entitlements when needed.
- Sources/<AppName>App.swift — @main entry, ModelContainer setup, scene config, optional onboarding routing.
- Sources/ContentView.swift — top-level TabView or NavigationStack root.
- Sources/Core/Theme.swift — ALL design tokens from the plan: accentColor, backgroundPrimary, backgroundSecondary, surfaceColor, cornerRadii (small/medium/large), spacing scale, typography helpers.
- Sources/Core/Components/*.swift — at least 3-4 reusable components (GlassCard, StatTile, SectionHeader, EmptyStateView, etc.).
- Sources/Features/<Feature>/**.swift — multiple feature views, @Observable stores, @Model types. Real logic, real layouts, real seed data using the exact items specified in the plan.
- Sources/Resources/Assets.xcassets/{Contents.json, AppIcon.appiconset/Contents.json, AccentColor.colorset/Contents.json}
- .gitignore — standard Xcode.

# Quality floor
- 24-40 source files. NEVER fewer than 16.
- Every substantive Swift file (Views, Stores, Services) must be at least 60 non-whitespace lines of real code.
- The app MUST be usable end-to-end on first launch: seeded data visible immediately, working CRUD or core flow, working navigation, working settings/preferences screen.
- No placeholder image assets — use SF Symbols + tasteful gradients/shapes.
- Every async path has loading, empty, and error UI.

You will be given the architect's plan (and optionally a designer spec). Execute it faithfully. If the plan has a gap, infer the most delightful interpretation and document the assumption in README.`;

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
          description: "All project files (24-40). Path is relative to project root. Content must be complete.",
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

// ─────────────────────────────────────────────────────────────
// PHASE 4: REVIEWER
// ─────────────────────────────────────────────────────────────
const REVIEWER_PROMPT = `You are a Senior iOS Quality Reviewer with Apple Design Award experience. You evaluate generated SwiftUI projects against a set of acceptance criteria.

You will receive:
1. The architect's acceptance criteria
2. A condensed project manifest (file paths, key file contents)

Your job is to identify BLOCKER issues only — things that would cause a build failure, runtime crash, or dramatically poor user experience on first launch. Minor polish issues are not blockers.

Blocker examples:
- A screen specified in the plan has no corresponding View file
- A file is empty or has a truncation marker ("// ...")
- Theme.swift is missing token definitions needed by other files
- A required framework import is missing from files that use it
- Seed data is generic placeholders ("Item 1", "Lorem ipsum", "example.com")
- An @Observable store is referenced but not defined
- A primary action button has no haptic feedback
- An async path has no loading state

Do NOT flag:
- Stylistic preferences
- Animation tuning
- Missing nice-to-have features not in the acceptance criteria
- Minor copy variations

Call "emit_review" exactly once.`;

const TOOL_REVIEW = {
  type: "function",
  function: {
    name: "emit_review",
    description: "Emit the quality review result.",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "Overall quality score 0-100." },
        approved: { type: "boolean", description: "True if no blocker issues found." },
        blockers: {
          type: "array",
          description: "Issues that must be fixed. Only include real blockers.",
          items: {
            type: "object",
            properties: {
              file: { type: "string", description: "File path, or 'project-level' if not file-specific." },
              issue: { type: "string" },
              fix: { type: "string", description: "Specific fix instruction for the refiner." },
            },
            required: ["file", "issue", "fix"],
            additionalProperties: false,
          },
        },
        summary: { type: "string", description: "1-2 sentence overall assessment." },
      },
      required: ["score", "approved", "blockers", "summary"],
      additionalProperties: false,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// PHASE 5: REFINER
// ─────────────────────────────────────────────────────────────
const TOOL_PATCH = {
  type: "function",
  function: {
    name: "emit_patches",
    description: "Emit only the files that need to be replaced to fix blocker issues.",
    parameters: {
      type: "object",
      properties: {
        patches: {
          type: "array",
          description: "Replacement files. Only include files that changed. Each must be complete.",
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
      required: ["patches"],
      additionalProperties: false,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// SSE helpers
// ─────────────────────────────────────────────────────────────
function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

// ─────────────────────────────────────────────────────────────
// Quota enforcement
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Gemini gateway
// ─────────────────────────────────────────────────────────────
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

// Anthropic requires "input_schema" where OpenAI uses "parameters".
function toAnthropicTool(t: { name: string; description: string; parameters: unknown }) {
  return { name: t.name, description: t.description, input_schema: t.parameters };
}

// ─────────────────────────────────────────────────────────────
// Server-side project validation
// ─────────────────────────────────────────────────────────────
function validateProject(project: unknown): string | null {
  if (!project || typeof project !== "object") return "Invalid project payload.";
  const p = project as { files?: unknown[] };
  if (!Array.isArray(p.files) || p.files.length < 16) {
    return `AI returned an incomplete project (need 16+ files, got ${(p.files as unknown[])?.length ?? 0}). Try again.`;
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
  const PLACEHOLDER_RE = /\b(lorem ipsum|placeholder|item \d+|example\.com|todo:)\b/i;
  const TRUNCATION_RE = /\/\/\s*\.\.\.\s*(rest of|TODO|truncated)/i;
  for (const f of p.files as { path: string; content: string }[]) {
    if (typeof f.content !== "string" || f.content.trim().length < 30) {
      return `File ${f.path} is empty or too short.`;
    }
    if (TRUNCATION_RE.test(f.content)) {
      return `File ${f.path} contains a truncation marker.`;
    }
    if (f.path.endsWith(".swift") && f.path.match(/Features|Core\/Components|Core\/Theme/) && PLACEHOLDER_RE.test(f.content)) {
      return `File ${f.path} contains placeholder content. Use real seed data from the plan.`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Build reviewer manifest (condensed view of the project)
// ─────────────────────────────────────────────────────────────
function buildReviewManifest(project: { files: { path: string; content: string }[] }, plan: Record<string, unknown>): string {
  const filePaths = project.files.map((f) => f.path).join("\n");
  const keyFiles = ["Theme.swift", "App.swift", "ContentView.swift"];
  const keyContents = project.files
    .filter((f) => keyFiles.some((k) => f.path.endsWith(k)))
    .map((f) => `### ${f.path}\n\`\`\`swift\n${f.content.slice(0, 2000)}\n\`\`\``)
    .join("\n\n");
  const shortFiles = project.files
    .filter((f) => f.path.endsWith(".swift") && f.content.trim().split("\n").length < 20)
    .map((f) => `- ${f.path} (${f.content.trim().split("\n").length} lines)`);
  return [
    `## Acceptance Criteria\n${(plan.acceptanceCriteria as string[] ?? []).map((c) => `- ${c}`).join("\n")}`,
    `## File Manifest (${project.files.length} files)\n${filePaths}`,
    shortFiles.length > 0 ? `## Suspiciously Short Files\n${shortFiles.join("\n")}` : "",
    `## Key File Contents\n${keyContents}`,
  ].filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// Claude path (Studio tier)
// ─────────────────────────────────────────────────────────────
async function generateWithClaude(
  prompt: string,
  anthropicKey: string,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
) {
  const enqueue = (type: string, data: Record<string, unknown>) =>
    controller.enqueue(encoder.encode(sseEvent(type, data)));

  // Phase 1: Architect
  enqueue("progress", { phase: "analyzing", message: "[claude] architect — designing app structure & design system…", percent: 10 });

  const architectResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      system: [{ type: "text", text: ARCHITECT_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [toAnthropicTool(TOOL_PLAN.function)],
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
  const plan = planBlock.input as Record<string, unknown>;

  // Phase 2: Designer
  enqueue("progress", { phase: "analyzing", message: "[claude] designer — specifying per-screen components & copy…", percent: 22 });

  const designerResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: [{ type: "text", text: DESIGNER_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [toAnthropicTool(TOOL_DESIGN.function)],
      tool_choice: { type: "tool", name: "emit_design_spec" },
      messages: [{
        role: "user",
        content: `Architect's plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nProduce the per-screen design specification now.`,
      }],
    }),
  });

  let designSpec: Record<string, unknown> | null = null;
  if (designerResp.ok) {
    const designerData = await designerResp.json();
    const designBlock = designerData.content?.find((b: { type: string }) => b.type === "tool_use");
    if (designBlock?.input) designSpec = designBlock.input;
  }

  // Phase 3: Engineer
  enqueue("progress", { phase: "generating", message: "[claude] engineer — writing Swift 6 project…", percent: 38 });

  const planForEngineer = JSON.stringify(plan, null, 2);
  const designForEngineer = designSpec ? `\n\nDesigner's per-screen spec (implement faithfully):\n\`\`\`json\n${JSON.stringify(designSpec, null, 2)}\n\`\`\`` : "";
  const engineerUserMsg = `Original user idea:\n"""\n${prompt}\n"""\n\nArchitect's plan (authoritative):\n\`\`\`json\n${planForEngineer}\n\`\`\`${designForEngineer}\n\nShip the complete Xcode project. 24-40 real, complete files. No stubs. Every Swift file ≥ 60 non-whitespace lines.`;

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
      system: [{ type: "text", text: ENGINEER_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [toAnthropicTool(TOOL_PROJECT.function)],
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
  let project = projectBlock.input as { files: { path: string; content: string }[]; appName: string; bundleId: string; summary: string };

  // Phase 4: Reviewer
  enqueue("progress", { phase: "bundling", message: "[claude] reviewer — checking acceptance criteria…", percent: 80 });

  const manifest = buildReviewManifest(project, plan);
  const reviewerResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: [{ type: "text", text: REVIEWER_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [toAnthropicTool(TOOL_REVIEW.function)],
      tool_choice: { type: "tool", name: "emit_review" },
      messages: [{
        role: "user",
        content: `Review this generated SwiftUI project:\n\n${manifest}`,
      }],
    }),
  });

  let review: { approved: boolean; blockers: { file: string; issue: string; fix: string }[]; score: number; summary: string } | null = null;
  if (reviewerResp.ok) {
    const reviewData = await reviewerResp.json();
    const reviewBlock = reviewData.content?.find((b: { type: string }) => b.type === "tool_use");
    if (reviewBlock?.input) review = reviewBlock.input;
  }

  // Phase 5: Refiner (if blockers found)
  if (review && !review.approved && review.blockers.length > 0) {
    enqueue("progress", { phase: "bundling", message: `[claude] refiner — patching ${review.blockers.length} issue(s)…`, percent: 88 });

    const blockerFiles = new Set(review.blockers.map((b) => b.file).filter((f) => f !== "project-level"));
    const filesToPatch = project.files.filter((f) => blockerFiles.has(f.path));
    const issueList = review.blockers.map((b) => `• [${b.file}] ${b.issue}\n  Fix: ${b.fix}`).join("\n");

    const refineResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 16000,
        system: `You are a Principal iOS Engineer fixing specific issues in a generated SwiftUI project. Output ONLY the files that need changes. Each file must be complete. No truncation.`,
        tools: [toAnthropicTool(TOOL_PATCH.function)],
        tool_choice: { type: "tool", name: "emit_patches" },
        messages: [{
          role: "user",
          content: `Fix these blocker issues in the project:\n${issueList}\n\nOriginal plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nFiles to patch:\n${filesToPatch.map((f) => `### ${f.path}\n\`\`\`swift\n${f.content}\n\`\`\``).join("\n\n")}\n\nReturn only the patched files using emit_patches.`,
        }],
      }),
    });

    if (refineResp.ok) {
      const refineData = await refineResp.json();
      const patchBlock = refineData.content?.find((b: { type: string }) => b.type === "tool_use");
      if (patchBlock?.input?.patches) {
        const patches = patchBlock.input.patches as { path: string; content: string }[];
        const patchMap = new Map(patches.map((p) => [p.path, p.content]));
        project = {
          ...project,
          files: project.files.map((f) => patchMap.has(f.path) ? { ...f, content: patchMap.get(f.path)! } : f),
        };
      }
    }
  }

  return { project, plan, review };
}

// ─────────────────────────────────────────────────────────────
// Gemini path (Free/Pro tier)
// ─────────────────────────────────────────────────────────────
async function generateWithGemini(
  prompt: string,
  lovableKey: string,
  encoder: TextEncoder,
  controller: ReadableStreamDefaultController,
) {
  const enqueue = (type: string, data: Record<string, unknown>) =>
    controller.enqueue(encoder.encode(sseEvent(type, data)));

  // Phase 1: Architect
  enqueue("progress", { phase: "analyzing", message: "[agent] architect — designing app structure & design system…", percent: 10 });

  const planResp = await callGateway({
    model: "google/gemini-2.5-flash",
    max_tokens: 6000,
    messages: [
      { role: "system", content: ARCHITECT_PROMPT },
      { role: "user", content: `App idea:\n"""\n${prompt}\n"""\n\nProduce the plan now.` },
    ],
    tools: [TOOL_PLAN],
    tool_choice: { type: "function", function: { name: "emit_app_plan" } },
  }, lovableKey);

  if (!planResp.ok) throw new Error(gatewayError(planResp.status));

  const planData = await planResp.json();
  const planCall = planData?.choices?.[0]?.message?.tool_calls?.[0];
  if (!planCall?.function?.arguments) throw new Error("Architect did not return a plan.");
  const plan = JSON.parse(planCall.function.arguments) as Record<string, unknown>;

  enqueue("progress", { phase: "generating", message: `[plan] ${plan.appName} · ${(plan.screens as unknown[])?.length ?? 0} screens · engineer starting…`, percent: 28 });

  // Phase 2: Engineer
  const planForEngineer = JSON.stringify(plan, null, 2);
  const engineerUserMsg = `Original user idea:\n"""\n${prompt}\n"""\n\nArchitect's plan (authoritative — implement faithfully):\n\`\`\`json\n${planForEngineer}\n\`\`\`\n\nNow ship the complete Xcode project. 24-40 real, complete files. Every Swift file ≥ 60 non-whitespace lines. No stubs. Use the designSystem tokens from the plan in Theme.swift. Use the exact accent color in AccentColor.colorset. Wire every framework listed. Implement every screen. Hit every delight moment and acceptance criterion.`;

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

  if (!buildResp.ok) throw new Error(gatewayError(buildResp.status));

  const buildData = await buildResp.json();
  const toolCall = buildData?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("AI did not return a project.");
  let project = JSON.parse(toolCall.function.arguments) as { files: { path: string; content: string }[]; appName: string; bundleId: string; summary: string };

  // Phase 3: Reviewer
  enqueue("progress", { phase: "bundling", message: "[agent] reviewer — checking acceptance criteria…", percent: 80 });

  const manifest = buildReviewManifest(project, plan);
  const reviewResp = await callGateway({
    model: "google/gemini-2.5-flash",
    max_tokens: 3000,
    messages: [
      { role: "system", content: REVIEWER_PROMPT },
      { role: "user", content: `Review this generated SwiftUI project:\n\n${manifest}` },
    ],
    tools: [TOOL_REVIEW],
    tool_choice: { type: "function", function: { name: "emit_review" } },
  }, lovableKey);

  let review: { approved: boolean; blockers: { file: string; issue: string; fix: string }[]; score: number; summary: string } | null = null;
  if (reviewResp.ok) {
    const reviewData = await reviewResp.json();
    const reviewCall = reviewData?.choices?.[0]?.message?.tool_calls?.[0];
    if (reviewCall?.function?.arguments) {
      try { review = JSON.parse(reviewCall.function.arguments); } catch { /* non-fatal */ }
    }
  }

  // Phase 4: Refiner (if blockers found)
  if (review && !review.approved && review.blockers.length > 0) {
    enqueue("progress", { phase: "bundling", message: `[agent] refiner — patching ${review.blockers.length} issue(s)…`, percent: 88 });

    const blockerFiles = new Set(review.blockers.map((b) => b.file).filter((f) => f !== "project-level"));
    const filesToPatch = project.files.filter((f) => blockerFiles.has(f.path));
    const issueList = review.blockers.map((b) => `• [${b.file}] ${b.issue}\n  Fix: ${b.fix}`).join("\n");

    const refineResp = await callGateway({
      model: "google/gemini-2.5-pro",
      max_tokens: 16000,
      messages: [
        { role: "system", content: "You are a Principal iOS Engineer fixing specific issues in a generated SwiftUI project. Return ONLY the files that need changes, complete, no truncation." },
        {
          role: "user",
          content: `Fix these issues:\n${issueList}\n\nPlan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nFiles to patch:\n${filesToPatch.map((f) => `### ${f.path}\n\`\`\`swift\n${f.content}\n\`\`\``).join("\n\n")}`,
        },
      ],
      tools: [TOOL_PATCH],
      tool_choice: { type: "function", function: { name: "emit_patches" } },
    }, lovableKey);

    if (refineResp.ok) {
      const refineData = await refineResp.json();
      const refineCall = refineData?.choices?.[0]?.message?.tool_calls?.[0];
      if (refineCall?.function?.arguments) {
        try {
          const patches = JSON.parse(refineCall.function.arguments).patches as { path: string; content: string }[];
          const patchMap = new Map(patches.map((p) => [p.path, p.content]));
          project = {
            ...project,
            files: project.files.map((f) => patchMap.has(f.path) ? { ...f, content: patchMap.get(f.path)! } : f),
          };
        } catch { /* non-fatal */ }
      }
    }
  }

  return { project, plan, review };
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
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

  if (model === "claude-opus" && userPlan !== "studio") {
    return new Response(
      JSON.stringify({ error: "Claude Opus is available on the Studio plan. Upgrade at /pricing." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sseEvent("progress", { phase: "analyzing", message: "> prompt received — initializing pipeline…", percent: 5 })));

        let project: unknown;
        let plan: unknown;
        let review: unknown;
        const modelUsed = model === "claude-opus" ? "claude-opus-4-7" : "gemini-2.5-pro";

        if (model === "claude-opus" && ANTHROPIC_API_KEY) {
          ({ project, plan, review } = await generateWithClaude(prompt, ANTHROPIC_API_KEY, encoder, controller));
        } else {
          if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured.");
          ({ project, plan, review } = await generateWithGemini(prompt, LOVABLE_API_KEY, encoder, controller));
        }

        controller.enqueue(encoder.encode(sseEvent("progress", { phase: "bundling", message: "[bundler] validating project structure…", percent: 93 })));

        const validationError = validateProject(project);
        if (validationError) throw new Error(validationError);

        const p = project as Record<string, unknown>;
        p.plan = plan;
        p.reviewScore = (review as { score?: number })?.score;

        if (userId) {
          const proj = project as { appName?: string; bundleId?: string; summary?: string; files?: unknown[] };
          await adminSupabase.from("generations").insert({
            user_id: userId,
            prompt,
            app_name: proj.appName,
            bundle_id: proj.bundleId,
            summary: proj.summary,
            files: proj.files,
            files_count: proj.files?.length ?? 0,
            status: "success",
            model_used: modelUsed,
            cost_usd: model === "claude-opus" ? 0.25 : 0.10,
          });
        }

        controller.enqueue(encoder.encode(sseEvent("progress", { phase: "done", message: "[done] project ready", percent: 100 })));
        controller.enqueue(encoder.encode(sseEvent("result", { project })));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("generate-ios-app error:", msg);

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
