// Web App Generation Pipeline
// Generates React + Tailwind CSS + Vite projects using the same
// Architect → Engineer → Reviewer pipeline as the iOS generator.
// Output: 15-25 files (page components, layout, hooks, Tailwind config, package.json)

import { createClient } from "jsr:@supabase/supabase-js@2";
import { callAI, AIError, AITool, DEFAULT_MODELS, FALLBACK_MODELS, getApiKey, Provider, type AICallOptions } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Architect Prompt (Web) ─────────────────────────────────────────────
const ARCHITECT_PROMPT = `You are a Senior Full-Stack Web Application Architect. Given a user idea, produce a detailed plan for a React + Tailwind CSS + Vite web application with an optional backend layer.

Your plan must include:
- appName: PascalCase (e.g. "MealPlanner")
- tagline: one-liner marketing pitch
- signatureFeature: the single feature that makes this app special
- accentColorHex: a DISTINCTIVE hex color (NOT default blue #3B82F6)
- visualPersonality: e.g. "bold and playful", "minimal and elegant", "dark and futuristic"
- designSystem: { accentColorHex, backgroundPrimary, backgroundSecondary, surfaceColor, textPrimary, textSecondary, fontFamily, borderRadius, shadowStyle, motionPersonality }
- pages: array of { name, route, purpose, primaryCTA, emptyStateCopy } — 3-5 pages
- dataModel: array of { name, fields: [{name, type}] } — 1-2 models
- frameworks: ["React", "Tailwind CSS", "Vite", plus any others]
- seedData: realistic example data (3-5 items per model) — specific names, numbers, dates
- userJourneys: 2-3 key user flows
- delightMoments: 3-4 specific micro-interactions (hover effects, transitions, animations)
- acceptanceCriteria: 5-7 testable quality gates
- apiRoutes: array of { method, path, purpose, requestBody?, responseShape } — 3-6 REST endpoints that the frontend calls. Include CRUD for each data model. Example: { method: "GET", path: "/api/tasks", purpose: "List all tasks", responseShape: "Task[]" }
- databaseSchema: array of { table, columns: [{name, type, constraints}] } — SQL table definitions matching the data models. Use snake_case column names. Include id (uuid, primary key), created_at (timestamptz), updated_at (timestamptz) on every table.
- authStrategy: one of "none" | "email_password" | "social_oauth" — determines whether the app includes user registration/login. For apps with personal data, user accounts, or multi-user features, use "email_password". For simple tools or utilities, use "none".

Scope constraint: Keep it to 3-5 pages, 1-2 models, 3-6 API routes, minimal dependencies. The engineer has a generous but finite output budget — a tight, detailed plan produces a polished app. A bloated plan produces truncated garbage.`;

const TOOL_WEB_PLAN = {
  name: "emit_web_plan",
  description: "Emit the web application plan.",
  parameters: {
    type: "object",
    properties: {
      appName: { type: "string" },
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
          fontFamily: { type: "string" },
          borderRadius: { type: "string" },
          shadowStyle: { type: "string" },
          motionPersonality: { type: "string" },
        },
      },
      pages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            route: { type: "string" },
            purpose: { type: "string" },
            primaryCTA: { type: "string" },
            emptyStateCopy: { type: "string" },
          },
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
                properties: { name: { type: "string" }, type: { type: "string" } },
              },
            },
          },
        },
      },
      frameworks: { type: "array", items: { type: "string" } },
      seedData: { type: "string" },
      userJourneys: { type: "array", items: { type: "string" } },
      delightMoments: { type: "array", items: { type: "string" } },
      acceptanceCriteria: { type: "array", items: { type: "string" } },
      apiRoutes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            method: { type: "string" },
            path: { type: "string" },
            purpose: { type: "string" },
            requestBody: { type: "string" },
            responseShape: { type: "string" },
          },
          required: ["method", "path", "purpose", "responseShape"],
        },
      },
      databaseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            table: { type: "string" },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  constraints: { type: "string" },
                },
                required: ["name", "type"],
              },
            },
          },
          required: ["table", "columns"],
        },
      },
      authStrategy: { type: "string", description: "none | email_password | social_oauth" },
    },
    required: [
      "appName", "tagline", "signatureFeature", "accentColorHex",
      "visualPersonality", "designSystem", "pages", "dataModel", "frameworks",
      "seedData", "userJourneys", "delightMoments", "acceptanceCriteria",
      "apiRoutes", "databaseSchema", "authStrategy",
    ],
  },
};

// ─── Engineer Prompt (Web) ──────────────────────────────────────────────
const ENGINEER_PROMPT = `You are a Senior Full-Stack React Engineer building a production-quality web application with React 18 + Tailwind CSS + Vite, with an integrated backend layer.

Rules:
1. TypeScript everywhere — strict mode, no \`any\`.
2. Functional components only. Use React hooks (useState, useEffect, useCallback, useMemo).
3. Tailwind CSS for all styling — no inline styles, no CSS modules.
4. Use the plan's designSystem tokens: map them to Tailwind config (colors, fonts, border-radius).
5. seed data from the plan — never use "Item 1", "Lorem ipsum", or placeholder text.
6. Use React Router v6 for routing (createBrowserRouter or BrowserRouter).
7. Responsive: mobile-first, looks great on phone, tablet, and desktop.
8. Transitions: use CSS transitions/animations or framer-motion for page transitions, hover effects, and entrance animations.
9. Accessibility: semantic HTML, ARIA labels, keyboard navigation, focus rings.
10. Each page component in its own file. Shared components in components/.

# Backend layer
If the plan includes apiRoutes and databaseSchema:
- Generate src/lib/api.ts — typed API client with fetch wrappers for each endpoint. All functions return typed responses. Example: \`export async function getTasks(): Promise<Task[]>\`
- Generate src/lib/db.ts — in-memory database implementation using a Map or array that holds the seed data. Exports CRUD functions that match the apiRoutes. This simulates a real database so the app works standalone.
- Generate server/api.ts — Express-style route handlers (one file) that wire up to db.ts. Include CORS headers, JSON parsing, error handling.
- Generate server/schema.sql — SQL DDL for all tables in databaseSchema. Include CREATE TABLE IF NOT EXISTS, constraints, indexes.
- All page components must call the API client (src/lib/api.ts), NOT import data directly. Data flows: Page → api.ts → db.ts (in standalone mode).

If the plan includes authStrategy !== "none":
- Generate src/lib/auth.ts — auth context with AuthProvider, useAuth hook, login/logout/register functions. Store user in localStorage for standalone mode.
- Generate src/components/AuthGuard.tsx — route wrapper that redirects to /login if not authenticated.
- Generate src/pages/Login.tsx and src/pages/Register.tsx — styled auth forms matching the design system.
- Wrap authenticated routes with AuthGuard in App.tsx.

# Anti-patterns that will cause AUTOMATED REJECTION:
- "TODO", "FIXME", "implement later", "placeholder" in any file
- Generic variable names like "item1", "data1"
- Empty function bodies or stub implementations
- Missing imports or unused imports
- Hardcoded colors instead of using the design system
- Default Tailwind blue (#3B82F6) as the primary color

File structure (15-30 files):
- package.json — with all dependencies (react, react-dom, react-router-dom, tailwindcss, @tailwindcss/vite, lucide-react, framer-motion)
- vite.config.ts — Vite config with React and Tailwind plugins
- tailwind.config.js — extended with designSystem tokens
- postcss.config.js — with tailwindcss and autoprefixer
- tsconfig.json — strict TypeScript config
- index.html — entry point with correct title and meta tags
- src/main.tsx — React entry with BrowserRouter
- src/App.tsx — root component with routes and layout
- src/index.css — Tailwind directives (@tailwind base/components/utilities) + custom CSS vars
- src/lib/data.ts — seed data and TypeScript types/interfaces
- src/lib/api.ts — typed API client functions
- src/lib/db.ts — in-memory database with seed data (standalone mode)
- src/lib/auth.ts — auth context + hooks (if authStrategy !== "none")
- src/components/*.tsx — reusable UI components
- src/pages/*.tsx — one per page in the plan (+ Login/Register if auth)
- src/hooks/*.ts — custom hooks if needed
- server/api.ts — backend route handlers
- server/schema.sql — database DDL

Every file must be COMPLETE. No stubs, no truncation. The app must work end-to-end on first \`npm run dev\`.

IMPORTANT: Prefer FEWER, COMPLETE files over MANY incomplete ones.`;

const TOOL_WEB_PROJECT = {
  name: "emit_web_project",
  description: "Emit the complete web application project.",
  parameters: {
    type: "object",
    properties: {
      appName: { type: "string" },
      summary: { type: "string", description: "1-2 sentence description." },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative file path, e.g. src/pages/Home.tsx" },
            content: { type: "string", description: "Complete file content." },
          },
          required: ["path", "content"],
        },
        description: "15-25 project files.",
      },
    },
    required: ["appName", "summary", "files"],
  },
};

// ─── Reviewer Prompt (Web) ──────────────────────────────────────────────
const REVIEWER_PROMPT = `You are a Senior Full-Stack Code Reviewer. Evaluate the generated React + Tailwind web project including its backend layer.

Score 0-100 on these dimensions:
- Completeness: All pages from the plan are implemented with real content
- Visual polish: Custom colors, animations, hover effects, responsive design
- Code quality: TypeScript strict, no any, proper hooks usage, clean imports
- Functionality: Routes work, seed data visible, interactions functional, API layer connected
- Accessibility: Semantic HTML, ARIA labels, keyboard nav, focus management
- Backend integration: API client calls backend, data flows through api.ts, CRUD operations work, auth guards protect routes (if auth enabled)

If score < 70, provide specific patches to fix the worst issues.
Call emit_web_review with your evaluation.`;

const TOOL_WEB_REVIEW = {
  name: "emit_web_review",
  description: "Emit the code review evaluation.",
  parameters: {
    type: "object",
    properties: {
      score: { type: "number", description: "0-100 quality score." },
      verdict: { type: "string", description: "pass or needs_refinement" },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            file: { type: "string" },
            severity: { type: "string", description: "error | warning" },
            message: { type: "string" },
          },
          required: ["file", "severity", "message"],
        },
      },
    },
    required: ["score", "verdict", "issues"],
  },
};

const TOOL_WEB_PATCH = {
  name: "emit_web_patch",
  description: "Emit patched files to fix review issues.",
  parameters: {
    type: "object",
    properties: {
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      },
    },
    required: ["files"],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────
function sseEvent(type: string, payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  studio: Infinity,
};

function checkQuota(plan: string, usage: number): boolean {
  return usage < (PLAN_LIMITS[plan] ?? PLAN_LIMITS.free);
}

function toAITool(t: { name: string; description: string; parameters: Record<string, unknown> }): AITool {
  return t;
}

function validateWebProject(
  project: { appName: string; summary: string; files: { path: string; content: string }[] },
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!project.files || project.files.length < 8) {
    errors.push(`Too few files: ${project.files?.length ?? 0} (minimum 8)`);
  }

  const requiredFiles = ["package.json", "index.html", "src/main.tsx", "src/App.tsx", "src/lib/api.ts"];
  for (const req of requiredFiles) {
    if (!project.files.some((f) => f.path === req || f.path.endsWith(req))) {
      errors.push(`Missing required file: ${req}`);
    }
  }

  const placeholderPatterns = [
    /\bplaceholder\b.*(?:text|content|data)/i,
    /"(?:Item|Thing|Data)\s*\d+"/,
    /\/\/\s*TODO(?::\s|$)/im,
    /throw\s+new\s+Error\(\s*["']not\s+implemented/i,
  ];

  for (const f of project.files) {
    for (const pat of placeholderPatterns) {
      if (pat.test(f.content)) {
        warnings.push(`${f.path}: may contain placeholder content`);
        break;
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function callWithFallback(
  opts: {
    provider: Provider;
    apiKey: string;
    model: string;
    system: string;
    userMessage: string;
    tool?: AITool;
    maxTokens?: number;
    timeoutMs?: number;
    enqueue?: (type: string, payload: Record<string, unknown>) => void;
  },
): Promise<{ text?: string; toolArgs?: Record<string, unknown> }> {
  const retryCallback: AICallOptions["onRetry"] = (attempt, max, delay, err) => {
    opts.enqueue?.("progress", {
      phase: "retrying",
      message: `Retry ${attempt}/${max} after ${Math.round(delay / 1000)}s — ${err.message.slice(0, 80)}`,
      percent: -1,
    });
  };

  try {
    return await callAI({
      provider: opts.provider,
      apiKey: opts.apiKey,
      model: opts.model,
      system: opts.system,
      userMessage: opts.userMessage,
      tool: opts.tool,
      maxTokens: opts.maxTokens ?? 65536,
      timeoutMs: opts.timeoutMs ?? 300_000,
      onRetry: retryCallback,
    });
  } catch (err) {
    if (err instanceof AIError && err.retryable) {
      const fallbackModel = FALLBACK_MODELS[opts.provider]?.engineer ?? opts.model;
      opts.enqueue?.("progress", {
        phase: "retrying",
        message: `Primary model failed, falling back to ${fallbackModel}…`,
        percent: -1,
      });
      return await callAI({
        provider: opts.provider,
        apiKey: opts.apiKey,
        model: fallbackModel,
        system: opts.system,
        userMessage: opts.userMessage,
        tool: opts.tool,
        maxTokens: opts.maxTokens ?? 65536,
        timeoutMs: opts.timeoutMs ?? 300_000,
        onRetry: retryCallback,
      });
    }
    throw err;
  }
}

// ─── Main handler ───────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { prompt, provider: providerHint } = await req.json();
  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provider: Provider = (providerHint === "anthropic" || providerHint === "opencode") ? providerHint : "gemini";
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: `${provider} API key not configured.` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check auth & quota
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseServiceKey);

  let userId: string | null = null;
  let userPlan = "free";
  let monthlyUsage = 0;

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const { data: { user } } = await userClient.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await userClient
          .from("profiles")
          .select("plan, monthly_usage")
          .eq("id", userId)
          .single();
        if (profile) {
          userPlan = profile.plan ?? "free";
          monthlyUsage = profile.monthly_usage ?? 0;
        }
      }
    } catch { /* anonymous */ }
  }

  if (userId && !checkQuota(userPlan, monthlyUsage)) {
    return new Response(JSON.stringify({ error: "Monthly generation limit reached." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const models = DEFAULT_MODELS[provider];
  const tag = `[${provider}]`;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (type: string, payload: Record<string, unknown>) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(type, payload)));

      try {
        // Phase 1: Architect
        enqueue("progress", { phase: "analyzing", message: `${tag} architect — designing web app…`, percent: 5 });

        const architect = await callWithFallback({
          provider, apiKey, model: models.architect,
          system: ARCHITECT_PROMPT,
          userMessage: `Design a React + Tailwind CSS web app for this idea:\n\n"${prompt}"`,
          tool: toAITool(TOOL_WEB_PLAN),
          maxTokens: 8192,
          timeoutMs: 120_000,
          enqueue,
        });

        const plan = architect.toolArgs;
        if (!plan) throw new Error("Architect did not return a plan.");
        enqueue("progress", { phase: "analyzing", message: `${tag} plan ready: "${(plan.appName as string) ?? "app"}" — ${(plan.pages as unknown[])?.length ?? 0} pages`, percent: 25 });

        // Phase 2: Engineer
        enqueue("progress", { phase: "generating", message: `${tag} engineer — writing React + TypeScript project…`, percent: 38 });

        const hasBackend = Array.isArray(plan.apiRoutes) && (plan.apiRoutes as unknown[]).length > 0;
        const hasAuth = plan.authStrategy && plan.authStrategy !== "none";
        const engineerUserMsg = `App idea: "${prompt}"\n\nArchitect's plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\nBuild the complete React + Tailwind web app. 15-30 files, all COMPLETE. Use the plan's designSystem tokens in tailwind.config.js. Use seedData for real content. Implement every page in the plan.${hasBackend ? "\n\nThe plan includes apiRoutes and databaseSchema — generate the full backend layer (src/lib/api.ts, src/lib/db.ts, server/api.ts, server/schema.sql). All page components must call the API client, NOT import seed data directly." : ""}${hasAuth ? `\n\nThe plan specifies authStrategy: \"${plan.authStrategy}\". Generate auth files (src/lib/auth.ts, src/components/AuthGuard.tsx, src/pages/Login.tsx, src/pages/Register.tsx) and wrap protected routes with AuthGuard.` : ""}`;

        const engineer = await callWithFallback({
          provider, apiKey, model: models.engineer,
          system: ENGINEER_PROMPT,
          userMessage: engineerUserMsg,
          tool: toAITool(TOOL_WEB_PROJECT),
          maxTokens: 65536,
          timeoutMs: 300_000,
          enqueue,
        });

        const project = engineer.toolArgs as { appName: string; summary: string; files: { path: string; content: string }[] } | undefined;
        if (!project?.files?.length) throw new Error("Engineer did not return a project.");

        // Validate
        const validation = validateWebProject(project);
        if (!validation.valid) {
          enqueue("progress", { phase: "generating", message: `${tag} validation failed: ${validation.errors.join("; ")}`, percent: 60 });
        }

        enqueue("progress", { phase: "bundling", message: `${tag} project built: ${project.files.length} files`, percent: 85 });

        // Emit result immediately (deferred review)
        const resultProject = { ...project, plan, bundleId: `web.${(plan.appName as string ?? "app").toLowerCase()}` };
        enqueue("result", { project: resultProject });
        enqueue("progress", { phase: "done", message: `${tag} web app ready for download`, percent: 100 });

        // Increment usage
        if (userId) {
          try {
            await userClient.rpc("increment_monthly_usage", { user_id: userId });
          } catch { /* non-fatal */ }
        }

        // Deferred review
        try {
          const reviewManifest = project.files
            .slice(0, 10)
            .map((f) => `// === ${f.path} ===\n${f.content.slice(0, 1500)}`)
            .join("\n\n");

          const reviewer = await callWithFallback({
            provider, apiKey, model: models.reviewer,
            system: REVIEWER_PROMPT,
            userMessage: `Review this React + Tailwind web project:\n\n${reviewManifest}`,
            tool: toAITool(TOOL_WEB_REVIEW),
            maxTokens: 4000,
            timeoutMs: 60_000,
            enqueue,
          });

          const review = reviewer.toolArgs as { score: number; verdict: string; issues: unknown[] } | undefined;
          if (review) {
            if (review.verdict === "needs_refinement" && review.score < 70) {
              // Refine
              const refiner = await callWithFallback({
                provider, apiKey, model: models.engineer,
                system: ENGINEER_PROMPT,
                userMessage: `Fix these issues in the project:\n${JSON.stringify(review.issues, null, 2)}\n\nOriginal files:\n${reviewManifest}\n\nReturn only the PATCHED files.`,
                tool: toAITool(TOOL_WEB_PATCH),
                maxTokens: 32000,
                timeoutMs: 120_000,
                enqueue,
              });

              const patches = refiner.toolArgs?.files as { path: string; content: string }[] | undefined;
              if (patches?.length) {
                const patchedFiles = [...project.files];
                for (const patch of patches) {
                  const idx = patchedFiles.findIndex((f) => f.path === patch.path);
                  if (idx >= 0) patchedFiles[idx] = patch;
                  else patchedFiles.push(patch);
                }
                enqueue("patch", { files: patchedFiles, reviewScore: review.score });
              }
            } else {
              enqueue("review", { reviewScore: review.score });
            }
          }
        } catch (e) {
          console.error("Review error (non-fatal):", e);
        }

        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = e instanceof AIError ? e.message : (e instanceof Error ? e.message : "Generation failed");
        enqueue("error", { message: msg });
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
