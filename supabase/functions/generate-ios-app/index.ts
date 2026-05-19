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
import { callAI, AIError, AITool, DEFAULT_MODELS, FALLBACK_MODELS, getApiKey, Provider, type AICallOptions } from "../_shared/ai.ts";
import { getSelectedPatterns, PATTERN_MENU } from "./component-library.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────
// PHASE 1: ARCHITECT
// ─────────────────────────────────────────────────────────────
const ARCHITECT_PROMPT = `You are a Staff iOS Product Architect who has shipped Apple Design Award-winning apps. Given a one-line app idea, produce a focused, opinionated product plan.

Think like an Apple Design Award judge. Be specific and concrete — the engineer implements exactly what you specify.

You MUST call "emit_app_plan" exactly once with:
- appName (PascalCase Swift identifier)
- bundleId (reverse-DNS, lowercased)
- tagline (one sentence, evocative)
- signatureFeature (the single standout feature that makes this app memorable, 1-2 sentences)
- accentColorHex (sRGB hex matching the concept's mood)
- visualPersonality (3-5 adjectives + 1 sentence describing the materials/typography vibe — e.g. "warm, tactile, organic — like handmade paper with rounded edges and soft shadows")
- designSystem: tokens the engineer MUST implement exactly in Theme.swift
  - accentColorHex, backgroundPrimary, backgroundSecondary, surfaceColor: hex values for the layered dark-mode background stack
  - textPrimary, textSecondary: hex values
  - cornerRadiusSmall (4-8pt), cornerRadiusMedium (12-16pt), cornerRadiusLarge (24-32pt)
  - fontStyle: "rounded" | "serif" | "monospaced" | "default" (maps to SF Pro variants)
  - spacingUnit: base grid spacing in pt (e.g. "8")
  - motionPersonality: one sentence — e.g. "spring(response:0.38,damping:0.7) everywhere, never ease-in-out"
- screens: 3-4 screens (NOT more), each with:
  - name, purpose
  - keyComponents: array of SPECIFIC, concrete UI elements (not "cards with stats" but "glassmorphic stat card with large SF Pro Rounded number, 12pt label below, radial highlight on tap")
  - interactions: what tapping/swiping/long-pressing does
  - emptyStateCopy: specific friendly copy + SF Symbol name
  - primaryCTA: exact button label and what it does
- dataModel: 1-2 SwiftData @Model entities with { name, fields [{name, type, notes}], relationships }
- frameworks: only Apple frameworks actually needed (SwiftUI, SwiftData are implicit). 0-2 extras max.
- seedData: 5-8 concrete sample records with REAL names, values, dates, and descriptions — these get hardcoded into the app and make it feel alive on first launch
- userJourneys: 1-2 happy-path flows, 3-5 steps each
- delightMoments: 3-4 specific micro-interactions with exact implementation hints:
  - e.g. ".sensoryFeedback(.success) on save", "matchedGeometryEffect hero transition from list to detail", "staggered list entrance with .spring(response:0.4)"
- acceptanceCriteria: 5-7 concrete, testable quality gates, e.g.:
  - "Every screen has a populated state with ≥3 seed data items visible"
  - "All primary action buttons trigger .sensoryFeedback(.success)"
  - "Empty states have a specific SF Symbol, friendly copy, and a CTA button"
  - "Theme.swift exports accentColor matching the plan's hex exactly"
- componentPatterns: select 4-7 IDs from the premium component library below that best fit this app. These are production-ready SwiftUI components the engineer will inject verbatim into the project.

Available component patterns:
${PATTERN_MENU}

You MUST select at least: "glass_card", "staggered_entrance", "empty_state_view", plus 1-4 others that fit the app concept.

Scope constraint: Keep it to 3-4 screens, 1-2 models, minimal frameworks. The engineer has a generous but finite output budget — a tight, detailed plan produces a polished app. A bloated plan with 6+ screens produces truncated garbage.`;

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
        componentPatterns: {
          type: "array",
          description: "IDs from the premium component library to inject into this project.",
          items: { type: "string" },
        },
      },
      required: [
        "appName", "bundleId", "tagline", "signatureFeature", "accentColorHex",
        "visualPersonality", "designSystem", "screens", "dataModel", "frameworks",
        "seedData", "userJourneys", "delightMoments", "acceptanceCriteria", "componentPatterns",
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
const ENGINEER_PROMPT = `You are a Principal iOS Engineer + Product Designer shipping production-grade SwiftUI apps for Xcode 16 / iOS 18+. Your output quality should match apps like Things 3, Bear, Linear, or Streaks.

# Engineering rules (non-negotiable)
- Pure SwiftUI. @main App struct.
- Swift 6 strict concurrency. @Observable (NEVER ObservableObject). @MainActor on view models.
- State: @State, @Bindable, @Environment. Persistence: SwiftData (@Model, @Query, ModelContainer). NEVER CoreData.
- Navigation: NavigationStack + value-based .navigationDestination(for:). NEVER NavigationView.
- Accessibility: .accessibilityLabel on all interactive elements, Dynamic Type support.
- One type per file. Extract subviews when body exceeds ~50 lines.

# Visual polish (what separates good from great)
- Theme.swift: implement ALL design tokens from the plan — colors, corner radii, spacing, typography helpers, motion presets. Every view references Theme, never hardcoded values.
- Custom typography: use .fontDesign(.rounded/.serif/.monospaced) to match the plan's fontStyle.
- SF Symbols 6: use .symbolEffect(.bounce) on key moments, .symbolRenderingMode(.hierarchical) for depth.
- Layered surfaces: use the plan's backgroundPrimary/Secondary/surface for visual depth. Add subtle .shadow or .ultraThinMaterial for glassmorphism where appropriate.
- Motion: spring animations (.snappy, .bouncy) for entrances, matchedGeometryEffect for hero transitions, .sensoryFeedback(.success/.impact/.warning) on all primary actions.
- Empty states: every screen has a designed empty state with a specific SF Symbol (large, secondary color), friendly copy, and a prominent CTA button.
- Loading states: use shimmer/skeleton placeholders (ProgressView is not enough).
- List entrances: stagger with .animation(.spring.delay(Double(index) * 0.05)).

# Anti-patterns that FAIL the quality bar
- Default List cells with no customization — use custom row views with padding, rounded corners, and the theme's surface color
- Plain .navigationTitle with no personality — add custom header views or styled inline titles
- SF Symbols in system blue only — tint with the theme's accent color
- Empty states that just say "No items yet" — add illustration (SF Symbol), warm copy, and CTA
- Buttons without .sensoryFeedback — every primary action needs haptics
- Generic "Delete" confirmations — use specific copy: "Delete 'Morning Run'?"
- Identical card layouts on every screen — each screen should have its own visual identity

# AUTOMATED REJECTION — your output is checked by a validator
The validator REJECTS files containing:
- The word "placeholder" (case-insensitive)
- "Lorem ipsum" anywhere
- Generic data: "Item 1", "Sample Item", "Test Item", "Example", "example.com"
- Truncation markers: "// ... rest", "// TODO: implement", "// add remaining"
- Comments with "// TODO" followed by action verbs (implement, add, fix, complete, handle)
- Any file shorter than 30 characters
Instead, use REAL data from the architect's seedData. Use those EXACT items. Invent realistic extras if needed. Every user-visible string must be specific and on-brand.

# Output contract
Call "emit_xcode_project" exactly once with 16-24 COMPLETE files.

Required files:
- README.md — what was built, screens, signature feature, Xcode 16 + xcodegen instructions.
- project.yml — XcodeGen spec: iOS 18.0, Swift 6, SwiftUI lifecycle, Info.plist usage descriptions.
- Sources/<AppName>App.swift — @main entry with ModelContainer, seed data insertion on first launch.
- Sources/ContentView.swift — root TabView or NavigationStack with polished tab/nav bar.
- Sources/Core/Theme.swift — ALL design tokens: colors, corner radii, spacing scale, typography helpers, motion presets. This is the design system — it must be comprehensive.
- Sources/Core/Components/*.swift — Use the PREMIUM COMPONENT LIBRARY provided below. Place each component in its own file. Import and USE them extensively in your feature views — they are the foundation of visual polish.
- Sources/Features/<Feature>/*.swift — views with real layouts, @Observable stores with real logic, @Model types. Use seed data. Each screen must look distinct.
- Sources/Resources/Assets.xcassets/ — Contents.json, AppIcon.appiconset/Contents.json, AccentColor.colorset/Contents.json
- .gitignore — standard Xcode.

Every file must be COMPLETE. No stubs, no truncation. The app must be usable end-to-end on first launch: seed data visible, working navigation, working CRUD, haptic feedback, polished animations.

IMPORTANT: Prefer FEWER, COMPLETE files over MANY incomplete ones. 18 polished files beats 30 truncated ones.

IMPORTANT: You will receive a PREMIUM COMPONENT LIBRARY section below. These are production-ready components — copy them into Sources/Core/Components/ and USE them in your feature views. Do NOT rewrite them from scratch. They are the foundation of visual quality.`;

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

// ─────────────────────────────────────────────────────────────
// PHASE 4: REVIEWER
// ─────────────────────────────────────────────────────────────
const REVIEWER_PROMPT = `You are a Senior iOS Quality Reviewer with Apple Design Award experience. You evaluate generated SwiftUI projects for both correctness AND visual polish.

You will receive:
1. The architect's acceptance criteria
2. A condensed project manifest (file paths, key file contents, feature views)

Your job is to identify BLOCKER issues — things that would cause a build failure, runtime crash, or a noticeably low-quality user experience.

Blocker examples:
- A screen specified in the plan has no corresponding View file
- A file is empty or has a truncation marker ("// ...")
- Theme.swift is missing token definitions (colors, radii, spacing) needed by views
- Views use hardcoded colors/values instead of Theme references
- Seed data is generic placeholders ("Item 1", "Lorem ipsum", "example.com")
- An @Observable store is referenced but not defined
- Missing .sensoryFeedback on primary action buttons
- Empty states with no SF Symbol, no CTA, just "No items yet"
- Default unstyled List cells with no custom row views
- No animations on list entrances or screen transitions
- ContentView has no TabView or NavigationStack structure

Do NOT flag:
- Minor copy variations from the plan
- Specific animation curve preferences
- Missing features not in the acceptance criteria

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

// Convert our OpenAI-style tool definitions to the AITool shape used by callAI.
function toAITool(t: { function: { name: string; description: string; parameters: Record<string, unknown> } }): AITool {
  return t.function;
}

function formatUserError(err: unknown): string {
  if (err instanceof AIError) {
    if (err.status === 503) return "The AI model is experiencing high demand. All retry attempts and fallback models were exhausted. Please try again in a few minutes.";
    if (err.status === 429) return "Rate limited by the AI provider. Please wait a moment and try again.";
    if (err.status === 408) return "The request timed out. Try a simpler app description, or try again later.";
    if (err.status === 500 || err.status === 502 || err.status === 504) return "The AI provider encountered a temporary issue. Please try again.";
  }
  if (err instanceof Error) {
    if (err.message.includes("incomplete project")) return err.message;
    if (err.message.includes("Missing required file")) return err.message;
    return `Generation failed: ${err.message}`;
  }
  return "An unexpected error occurred. Please try again.";
}

// ─────────────────────────────────────────────────────────────
// Server-side project validation
// ─────────────────────────────────────────────────────────────
// Validation returns an object: hard errors are fatal, soft issues are healable.
interface ValidationResult {
  hardError: string | null;      // structural problem — cannot proceed
  softIssues: { file: string; issue: string }[];  // content quality — can be auto-healed
}

function validateProject(project: unknown): ValidationResult {
  const result: ValidationResult = { hardError: null, softIssues: [] };
  if (!project || typeof project !== "object") { result.hardError = "Invalid project payload."; return result; }
  const p = project as { files?: unknown[] };
  if (!Array.isArray(p.files) || p.files.length < 10) {
    result.hardError = `AI returned an incomplete project (need 10+ files, got ${(p.files as unknown[])?.length ?? 0}). Try again.`;
    return result;
  }
  const paths = new Set<string>((p.files as { path: string }[]).map((f) => f.path));
  for (const r of ["README.md", "project.yml", ".gitignore"]) {
    if (!paths.has(r)) { result.hardError = `Missing required file: ${r}`; return result; }
  }
  const hasAppEntry = [...paths].some((p) => /Sources\/.*App\.swift$/.test(p));
  const hasContentView = [...paths].some((p) => p.endsWith("Sources/ContentView.swift"));
  const hasTheme = [...paths].some((p) => p.endsWith("Theme.swift"));
  if (!hasAppEntry) { result.hardError = "Missing @main App entry file."; return result; }
  if (!hasContentView) { result.hardError = "Missing ContentView.swift."; return result; }
  if (!hasTheme) { result.hardError = "Missing Core/Theme.swift."; return result; }

  // Content quality checks — these are healable (soft issues)
  const PLACEHOLDER_RE = /\b(lorem ipsum|placeholder|sample item|test item)\b/i;
  const GENERIC_DATA_RE = /"Item \d+"|"Example[^"]*"|"example\.com"/;
  const TRUNCATION_RE = /\/\/\s*\.\.\.\s*(rest|TODO|truncated|add|implement)/i;
  const TODO_ACTION_RE = /\/\/\s*TODO:\s*(implement|add|fix|complete|finish|handle|wire|connect|update)/i;
  for (const f of p.files as { path: string; content: string }[]) {
    if (typeof f.content !== "string" || f.content.trim().length < 30) {
      result.softIssues.push({ file: f.path, issue: "File is empty or too short (< 30 chars)." });
      continue;
    }
    if (TRUNCATION_RE.test(f.content)) {
      result.softIssues.push({ file: f.path, issue: `Contains truncation marker: ${f.content.match(TRUNCATION_RE)?.[0]}` });
    }
    if (f.path.endsWith(".swift") && f.path.match(/Features|Core\/Components|Core\/Theme/)) {
      if (PLACEHOLDER_RE.test(f.content)) {
        result.softIssues.push({ file: f.path, issue: `Contains placeholder text: ${f.content.match(PLACEHOLDER_RE)?.[0]}` });
      }
      if (GENERIC_DATA_RE.test(f.content)) {
        result.softIssues.push({ file: f.path, issue: `Contains generic data: ${f.content.match(GENERIC_DATA_RE)?.[0]}` });
      }
      if (TODO_ACTION_RE.test(f.content)) {
        result.softIssues.push({ file: f.path, issue: `Contains TODO stub: ${f.content.match(TODO_ACTION_RE)?.[0]}` });
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Build reviewer manifest (condensed view of the project)
// ─────────────────────────────────────────────────────────────
// ── Auto-heal: re-prompt Engineer to fix specific files ──
async function healProject(
  project: { files: { path: string; content: string }[]; appName: string; bundleId: string; summary: string },
  issues: { file: string; issue: string }[],
  plan: Record<string, unknown>,
  provider: Provider,
  apiKey: string,
  enqueue: (type: string, data: Record<string, unknown>) => void,
): Promise<typeof project> {
  const models = DEFAULT_MODELS[provider];
  const fallbacks = FALLBACK_MODELS[provider];
  const affectedPaths = new Set(issues.map((i) => i.file));
  const filesToFix = project.files.filter((f) => affectedPaths.has(f.path));
  if (filesToFix.length === 0) return project;

  const issueList = issues.map((i) => `• [${i.file}] ${i.issue}`).join("\n");
  enqueue("progress", {
    phase: "healing",
    message: `[healer] fixing ${issues.length} quality issue(s) in ${filesToFix.length} file(s)…`,
    percent: -1,
  });

  try {
    const healer = await callWithFallback({
      provider, apiKey, model: models.engineer,
      system: `You are a Senior iOS Engineer fixing quality issues in generated Swift files. Replace placeholder content, generic data, and TODO stubs with real code using seed data from the plan. Each output file must be COMPLETE.`,
      userMessage: `These files failed validation:\n${issueList}\n\nSeed data from plan:\n${JSON.stringify((plan as Record<string, unknown>).seedData ?? "", null, 2)}\n\nFiles to fix:\n${filesToFix.map((f) => `### ${f.path}\n\`\`\`swift\n${f.content}\n\`\`\``).join("\n\n")}\n\nReturn complete fixed files using emit_patches. No placeholders, no TODO stubs, no generic data.`,
      tool: toAITool(TOOL_PATCH),
      maxTokens: 16000,
      timeoutMs: 120_000,
    }, fallbacks.engineer, enqueue, "Healer");
    const patches = ((healer.toolArgs?.patches ?? []) as { path: string; content: string }[]);
    if (patches.length > 0) {
      const patchMap = new Map(patches.map((p) => [p.path, p.content]));
      return {
        ...project,
        files: project.files.map((f) => patchMap.has(f.path) ? { ...f, content: patchMap.get(f.path)! } : f),
      };
    }
  } catch {
    enqueue("progress", { phase: "healing", message: "[healer] auto-fix failed — continuing with original files", percent: -1 });
  }
  return project;
}

function buildReviewManifest(project: { files: { path: string; content: string }[] }, plan: Record<string, unknown>): string {
  const filePaths = project.files.map((f) => f.path).join("\n");
  const keyFiles = ["Theme.swift", "App.swift", "ContentView.swift"];
  const keyContents = project.files
    .filter((f) => keyFiles.some((k) => f.path.endsWith(k)))
    .map((f) => `### ${f.path}\n\`\`\`swift\n${f.content.slice(0, 2000)}\n\`\`\``)
    .join("\n\n");

  const featureViews = project.files
    .filter((f) => f.path.endsWith(".swift") && /Features/.*View\.swift$/.test(f.path))
    .map((f) => `### ${f.path}\n\`\`\`swift\n${f.content.slice(0, 1500)}\n\`\`\``)
    .join("\n\n");

  const storeAndServiceFiles = project.files
    .filter((f) => f.path.endsWith(".swift") && /(Store|Service|Manager|Repository)\.swift$/.test(f.path))
    .map((f) => `### ${f.path}\n\`\`\`swift\n${f.content.slice(0, 1500)}\n\`\`\``)
    .join("\n\n");

  const shortFiles = project.files
    .filter((f) => f.path.endsWith(".swift") && f.content.trim().split("\n").length < 20)
    .map((f) => `- ${f.path} (${f.content.trim().split("\n").length} lines)`);

  const deprecatedPatterns: string[] = [];
  for (const f of project.files) {
    if (!f.path.endsWith(".swift")) continue;
    if (/\bObservableObject\b/.test(f.content)) deprecatedPatterns.push(`- ${f.path}: uses ObservableObject (should use @Observable)`);
    if (/\bNavigationView\b/.test(f.content)) deprecatedPatterns.push(`- ${f.path}: uses NavigationView (should use NavigationStack)`);
    if (/\bimport CoreData\b/.test(f.content)) deprecatedPatterns.push(`- ${f.path}: uses CoreData (should use SwiftData)`);
  }

  return [
    `## Acceptance Criteria\n${(plan.acceptanceCriteria as string[] ?? []).map((c) => `- ${c}`).join("\n")}`,
    `## File Manifest (${project.files.length} files)\n${filePaths}`,
    shortFiles.length > 0 ? `## Suspiciously Short Files\n${shortFiles.join("\n")}` : "",
    deprecatedPatterns.length > 0 ? `## Deprecated Patterns Found\n${deprecatedPatterns.join("\n")}` : "",
    `## Key File Contents\n${keyContents}`,
    featureViews ? `## Feature Views\n${featureViews}` : "",
    storeAndServiceFiles ? `## Store & Service Files\n${storeAndServiceFiles}` : "",
  ].filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// callWithFallback: tries primary model, falls back to lighter model
// ─────────────────────────────────────────────────────────────
async function callWithFallback(
  opts: AICallOptions,
  fallbackModel: string,
  enqueue: (type: string, data: Record<string, unknown>) => void,
  phaseName: string,
): Promise<ReturnType<typeof callAI>> {
  const retryCallback = (attempt: number, max: number, delayMs: number, err: AIError) => {
    enqueue("progress", {
      phase: "retrying",
      message: `⚠ ${phaseName}: ${err.status} — retry ${attempt}/${max} in ${(delayMs / 1000).toFixed(1)}s…`,
      percent: -1,
    });
  };
  try {
    return await callAI({ ...opts, onRetry: retryCallback });
  } catch (err) {
    if (err instanceof AIError && err.retryable && fallbackModel !== opts.model) {
      enqueue("progress", {
        phase: "retrying",
        message: `↻ ${phaseName}: switching to fallback model (${fallbackModel})…`,
        percent: -1,
      });
      return await callAI({ ...opts, model: fallbackModel, maxRetries: 2, onRetry: retryCallback });
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Generation pipeline (provider-agnostic)
// ─────────────────────────────────────────────────────────────
// ── Phase 1-3: Core generation (Architect → Designer → Engineer) ──
// Returns the project as soon as code generation is done so the caller
// can stream the result to the user immediately.
async function generateProject(
  prompt: string,
  provider: Provider,
  apiKey: string,
  enqueue: (type: string, data: Record<string, unknown>) => void,
) {
  const models = DEFAULT_MODELS[provider];
  const fallbacks = FALLBACK_MODELS[provider];
  const tag = `[${provider}]`;

  // Phase 1: Architect
  enqueue("progress", { phase: "analyzing", message: `${tag} architect — designing app structure & design system…`, percent: 10 });
  const architect = await callWithFallback({
    provider, apiKey, model: models.architect,
    system: ARCHITECT_PROMPT,
    userMessage: `App idea:\n"""\n${prompt}\n"""\n\nProduce the plan now.`,
    tool: toAITool(TOOL_PLAN),
    maxTokens: 6000,
  }, fallbacks.architect, enqueue, "Architect");
  const plan = architect.toolArgs as Record<string, unknown>;

  enqueue("progress", { phase: "generating", message: `[plan] ${plan.appName} · ${(plan.screens as unknown[])?.length ?? 0} screens · engineer starting…`, percent: 28 });

  // Phase 2: Designer (richer providers only — Gemini already produces a strong plan)
  let designSpec: Record<string, unknown> | null = null;
  if (provider !== "gemini") {
    enqueue("progress", { phase: "analyzing", message: `${tag} designer — specifying per-screen components & copy…`, percent: 22 });
    try {
      const designer = await callWithFallback({
        provider, apiKey, model: models.architect,
        system: DESIGNER_PROMPT,
        userMessage: `Architect's plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nProduce the per-screen design specification now.`,
        tool: toAITool(TOOL_DESIGN),
        maxTokens: 8000,
      }, fallbacks.architect, enqueue, "Designer");
      designSpec = designer.toolArgs ?? null;
    } catch { /* non-fatal */ }
  }

  // Phase 3: Engineer
  enqueue("progress", { phase: "generating", message: `${tag} engineer — writing Swift 6 project…`, percent: 38 });
  const designForEngineer = designSpec ? `\n\nDesigner's per-screen spec (implement faithfully):\n\`\`\`json\n${JSON.stringify(designSpec, null, 2)}\n\`\`\`` : "";
  // Inject selected premium component patterns
  const selectedPatternIds = (plan.componentPatterns as string[] ?? ["glass_card", "staggered_entrance", "empty_state_view", "shimmer_modifier"]);
  const componentLibrary = getSelectedPatterns(selectedPatternIds);
  const componentContext = componentLibrary
    ? `\n\n## PREMIUM COMPONENT LIBRARY\n${componentLibrary}\n\nPlace each component in Sources/Core/Components/<Name>.swift. Use them extensively in your feature views.`
    : "";
  const engineerUserMsg = `App idea: "${prompt}"\n\nArchitect's plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`${designForEngineer}${componentContext}\n\nBuild the complete Xcode project. 16-24 files, all COMPLETE. Use the plan's designSystem tokens in Theme.swift. Use seedData for real content. Implement every screen in the plan. USE the premium components provided above — they are your visual effects foundation.`;
  const engineer = await callWithFallback({
    provider, apiKey, model: models.engineer,
    system: ENGINEER_PROMPT,
    userMessage: engineerUserMsg,
    tool: toAITool(TOOL_PROJECT),
    maxTokens: 65536,
    timeoutMs: 300_000,
  }, fallbacks.engineer, enqueue, "Engineer");
  const project = engineer.toolArgs as { files: { path: string; content: string }[]; appName: string; bundleId: string; summary: string };

  return { project, plan };
}

// ── Phase 4-5: Deferred review + refine ──
// Runs AFTER the initial result is streamed to the user.  If the reviewer
// finds blocker issues the refiner patches them and a "patch" SSE event
// is emitted so the frontend can hot-swap the affected files.
async function reviewAndRefine(
  project: { files: { path: string; content: string }[]; appName: string; bundleId: string; summary: string },
  plan: Record<string, unknown>,
  provider: Provider,
  apiKey: string,
  enqueue: (type: string, data: Record<string, unknown>) => void,
): Promise<{ patchedProject: typeof project; review: { approved: boolean; blockers: { file: string; issue: string; fix: string }[]; score: number; summary: string } | null }> {
  const models = DEFAULT_MODELS[provider];
  const fallbacks = FALLBACK_MODELS[provider];
  const tag = `[${provider}]`;

  // Phase 4: Reviewer
  enqueue("progress", { phase: "reviewing", message: `${tag} reviewer — checking ${(plan.acceptanceCriteria as string[] ?? []).length} acceptance criteria…`, percent: -1 });
  const manifest = buildReviewManifest(project, plan);
  let review: { approved: boolean; blockers: { file: string; issue: string; fix: string }[]; score: number; summary: string } | null = null;
  try {
    const reviewer = await callWithFallback({
      provider, apiKey, model: models.reviewer,
      system: REVIEWER_PROMPT,
      userMessage: `Review this generated SwiftUI project:\n\n${manifest}`,
      tool: toAITool(TOOL_REVIEW),
      maxTokens: 3000,
    }, fallbacks.reviewer, enqueue, "Reviewer");
    review = reviewer.toolArgs as typeof review;
  } catch { /* non-fatal */ }

  let patchedProject = project;

  // Phase 5: Refiner (if blockers found)
  if (review && !review.approved && review.blockers.length > 0) {
    const blockerSummary = review.blockers.slice(0, 3).map((b) => b.issue.slice(0, 60)).join("; ");
    enqueue("progress", { phase: "reviewing", message: `${tag} refiner — patching ${review.blockers.length} issue(s): ${blockerSummary}`, percent: -1 });
    const blockerFiles = new Set(review.blockers.map((b) => b.file).filter((f) => f !== "project-level"));
    const filesToPatch = project.files.filter((f) => blockerFiles.has(f.path));
    const issueList = review.blockers.map((b) => `• [${b.file}] ${b.issue}\n  Fix: ${b.fix}`).join("\n");
    try {
      const refiner = await callWithFallback({
        provider, apiKey, model: models.engineer,
        system: "You are a Principal iOS Engineer fixing specific issues in a generated SwiftUI project. Output ONLY the files that need changes. Each file must be complete. No truncation.",
        userMessage: `Fix these blocker issues in the project:\n${issueList}\n\nOriginal plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nFiles to patch:\n${filesToPatch.map((f) => `### ${f.path}\n\`\`\`swift\n${f.content}\n\`\`\``).join("\n\n")}\n\nReturn only the patched files using emit_patches.`,
        tool: toAITool(TOOL_PATCH),
        maxTokens: 16000,
      }, fallbacks.engineer, enqueue, "Refiner");
      const patches = ((refiner.toolArgs?.patches ?? []) as { path: string; content: string }[]);
      const patchMap = new Map(patches.map((p) => [p.path, p.content]));
      patchedProject = {
        ...project,
        files: project.files.map((f) => patchMap.has(f.path) ? { ...f, content: patchMap.get(f.path)! } : f),
      };
    } catch { /* non-fatal */ }
  }

  return { patchedProject, review };
}

// ─────────────────────────────────────────────────────────────
// Rate limiting (per-IP, sliding window)
// ─────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("cf-connecting-ip")
    ?? "unknown";

  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a minute before trying again." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
    );
  }

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

  let body: { prompt?: string; provider?: Provider };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { prompt, provider = "gemini" } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return new Response(
      JSON.stringify({ error: "Please describe the app you want to build (min 5 chars)." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!["gemini", "anthropic", "opencode"].includes(provider)) {
    return new Response(
      JSON.stringify({ error: `Unknown provider "${provider}". Use gemini, anthropic, or opencode.` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (provider !== "gemini" && userPlan !== "studio") {
    return new Response(
      JSON.stringify({ error: `${provider === "anthropic" ? "Claude" : "Opencode Zen"} requires the Studio plan. Upgrade at /pricing.` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: `${provider} API key not configured on the server. Set ${provider === "gemini" ? "GEMINI_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENCODE_API_KEY"} in Supabase function secrets.` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const modelUsed = DEFAULT_MODELS[provider].engineer;
  const costEstimate = provider === "anthropic" ? 0.30 : provider === "opencode" ? 0.25 : 0.20;
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (type: string, data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(sseEvent(type, data)));
      try {
        enqueue("progress", { phase: "analyzing", message: "> prompt received — initializing pipeline…", percent: 5 });

        // ── Phases 1-3: generate the project (Architect → Engineer) ──
        const generated = await generateProject(prompt, provider, apiKey, enqueue);
        let project = generated.project;
        const plan = generated.plan;

        enqueue("progress", { phase: "bundling", message: "[bundler] validating project structure…", percent: 93 });
        let validation = validateProject(project);
        if (validation.hardError) throw new Error(validation.hardError);

        // Auto-heal soft issues (placeholder content, short files, TODO stubs)
        if (validation.softIssues.length > 0) {
          enqueue("progress", { phase: "healing", message: `[validator] found ${validation.softIssues.length} quality issue(s) — auto-fixing…`, percent: 94 });
          project = await healProject(project, validation.softIssues, plan, provider, apiKey, enqueue);

          // Re-validate after healing
          validation = validateProject(project);
          if (validation.hardError) throw new Error(validation.hardError);
          if (validation.softIssues.length > 0) {
            enqueue("progress", { phase: "healing", message: `[validator] ${validation.softIssues.length} issue(s) remain after auto-fix — streaming anyway`, percent: 96 });
          } else {
            enqueue("progress", { phase: "healing", message: "[validator] all quality issues resolved", percent: 97 });
          }
        }

        const p = project as Record<string, unknown>;
        p.plan = plan;

        // ── Stream result — user sees the project NOW ──
        enqueue("progress", { phase: "done", message: "[done] project ready", percent: 100 });
        enqueue("result", { project });

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
            cost_usd: costEstimate,
          });
        }

        // ── Phases 4-5: deferred review + refine (runs while user
        //    already has the project open) ──
        try {
          const { patchedProject, review } = await reviewAndRefine(
            project, plan, provider, apiKey, enqueue,
          );
          const reviewScore = (review as { score?: number } | null)?.score;
          if (patchedProject !== project && patchedProject.files !== project.files) {
            enqueue("patch", {
              files: patchedProject.files,
              reviewScore,
              reviewSummary: review?.summary ?? null,
            });
          } else if (review) {
            enqueue("review", { reviewScore, reviewSummary: review.summary });
          }
        } catch {
          // review/refine failures are non-fatal — the user already has
          // the project from the result event above.
        }

      } catch (err) {
        const msg = err instanceof AIError
          ? err.message
          : err instanceof Error ? err.message : "Unknown error";
        const stack = err instanceof Error ? err.stack : "";
        console.error("generate-ios-app error:", msg, stack);

        const userMessage = formatUserError(err);

        if (userId) {
          await adminSupabase.from("generations").insert({
            user_id: userId,
            prompt,
            status: "failed",
            model_used: modelUsed,
          });
        }

        enqueue("error", { message: userMessage });
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
