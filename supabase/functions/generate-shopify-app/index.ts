// Shopify App Generation Pipeline
// Produces an installable, Built-for-Shopify-minded embedded admin app on the
// official React Router template (@shopify/shopify-app-react-router + Polaris).
// Architect → Engineer → Reviewer, streamed over SSE, metered through the
// shared quota module. The scaffold (OAuth/session/webhooks/billing plumbing)
// is injected; the AI spends its budget on merchant-specific value.

import { callAI, AIError, AITool, DEFAULT_MODELS, FALLBACK_MODELS, getApiKey, Provider, type AICallOptions } from "../_shared/ai.ts";
import {
  adminClient, resolveUserId, clientIp, hashIp,
  checkUserQuota, checkAnonQuota, recordGeneration, recordAnonGeneration, isBurstLimited,
} from "../_shared/quota.ts";
import { providerAllowed } from "../_shared/plan-limits.ts";
import { COMMON_SCOPES, isProtectedScope, ADMIN_API_VERSION } from "../_shared/shopify.ts";
import {
  getShopifyScaffoldFiles, getSelectedPolarisPatterns, scaffoldPaths,
  POLARIS_PATTERN_MENU,
} from "./scaffold.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Architect ───────────────────────────────────────────────────────────
const ARCHITECT_PROMPT = `You are a Staff Shopify App Architect who has shipped multiple Built for Shopify apps. Given a merchant's idea, design a focused, installable embedded admin app on the React Router template.

Design principles (these are scored later):
- MINIMIZE access scopes. Request only what the features truly need — fewer scopes is a Built for Shopify signal and avoids protected-data review friction.
- Real merchant value: every screen must do something useful with the merchant's actual store data via the Admin GraphQL API.
- Keep it tight: 2-4 screens, 1-3 Prisma models, 3-6 GraphQL operations. A tight plan produces a polished app; a bloated plan produces truncated garbage.

Available access scopes to choose from (pick the minimal set): ${COMMON_SCOPES.join(", ")}.

You MUST also pick 3-5 Polaris pattern recipes the engineer will follow:
${POLARIS_PATTERN_MENU}

Call emit_shopify_plan exactly once.`;

const TOOL_PLAN: AITool = {
  name: "emit_shopify_plan",
  description: "Emit the Shopify app plan.",
  parameters: {
    type: "object",
    properties: {
      appName: { type: "string", description: "Human-friendly app name, e.g. 'Low Stock Alerts'" },
      tagline: { type: "string" },
      archetype: { type: "string", description: "embedded_admin (default) | admin_extension | pos_extension | sales_channel" },
      signatureFeature: { type: "string" },
      scopes: { type: "array", items: { type: "string" }, description: "Minimal access scopes from the allowed list." },
      scopeJustification: { type: "string", description: "One line per scope explaining why it is needed." },
      navigation: {
        type: "array",
        items: { type: "object", properties: { label: { type: "string" }, route: { type: "string" } }, required: ["label", "route"] },
        description: "Nav links shown in the embedded app (App Bridge NavMenu). Routes like /app/items.",
      },
      screens: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            route: { type: "string", description: "React Router route file path, e.g. app/routes/app._index.tsx" },
            purpose: { type: "string" },
            polarisPattern: { type: "string", description: "Which pattern id this screen uses." },
            emptyState: { type: "string" },
          },
          required: ["name", "route", "purpose"],
        },
      },
      dataModels: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Prisma model name (PascalCase)." },
            fields: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" } }, required: ["name", "type"] } },
          },
          required: ["name", "fields"],
        },
        description: "App-owned data persisted in Prisma. Always keyed by shop. Empty if the app is stateless.",
      },
      graphqlOperations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string", description: "query | mutation" },
            purpose: { type: "string" },
            rootField: { type: "string", description: "Admin API root field, e.g. products, productUpdate, inventoryLevels." },
          },
          required: ["name", "type", "purpose", "rootField"],
        },
        description: "Admin GraphQL operations the app performs.",
      },
      webhooks: { type: "array", items: { type: "string" }, description: "Webhook topics beyond the mandatory app/uninstalled + app/scopes_update." },
      billing: {
        type: "object",
        properties: {
          model: { type: "string", description: "free | one_time | recurring" },
          priceUsd: { type: "number" },
          trialDays: { type: "number" },
        },
      },
      polarisPatterns: { type: "array", items: { type: "string" }, description: "3-5 pattern ids from the menu." },
      acceptanceCriteria: { type: "array", items: { type: "string" }, description: "5-7 testable quality gates." },
    },
    required: [
      "appName", "tagline", "archetype", "scopes", "scopeJustification",
      "navigation", "screens", "dataModels", "graphqlOperations",
      "polarisPatterns", "acceptanceCriteria",
    ],
  },
};

// ─── Engineer ──────────────────────────────────────────────────────────────
const ENGINEER_PROMPT = `You are a Senior Shopify App Engineer building a production-quality embedded admin app with the React Router template, @shopify/shopify-app-react-router, and @shopify/polaris.

Hard rules (violations cause automated rejection):
1. TypeScript strict — no \`any\`, no \`// @ts-ignore\`.
2. EVERY route loader/action authenticates: \`const { admin, session } = await authenticate.admin(request);\` (import { authenticate } from "../shopify.server"). Never read store data without authenticating.
3. ALL store data comes from the Admin GraphQL API via \`admin.graphql(\\\`#graphql ...\\\`, { variables })\` inside loaders/actions — never hardcode catalog data.
4. UI uses ONLY @shopify/polaris components (Page, Card, Layout, IndexTable, BlockStack, Text, Button, etc.). No raw HTML layout, no inline styles, no Tailwind.
5. App-owned data uses Prisma, always scoped by \`shop\` (from session.shop).
6. Mutations/forms use React Router <Form>/useFetcher + route actions. Show the App Bridge save bar for dirty forms.
7. Provide an empty state for every index/list screen.
8. Follow the Polaris pattern recipes provided.

# prisma/schema.prisma — YOU MUST GENERATE THIS and it MUST include this exact Session model plus your app models:
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }
model Session {
  id String @id
  shop String
  state String
  isOnline Boolean @default(false)
  scope String?
  expires DateTime?
  accessToken String
  userId BigInt?
  firstName String?
  lastName String?
  email String?
  accountOwner Boolean @default(false)
  locale String?
  collaborator Boolean? @default(false)
  emailVerified Boolean? @default(false)
}

# Files YOU generate (10-18 files):
- prisma/schema.prisma (Session model + app models)
- app/routes/app._index.tsx (home screen)
- app/routes/app.<feature>.tsx (one per screen in the plan)
- app/lib/queries.server.ts (typed Admin GraphQL operation helpers)
- app/components/*.tsx (shared Polaris components, if needed)

# Files that are PRE-INJECTED — do NOT generate them:
package.json, tsconfig.json, vite.config.ts, react-router.config.ts, env.d.ts,
app/shopify.server.ts, app/db.server.ts, app/root.tsx, app/entry.server.tsx,
app/routes/app.tsx (the shell with AppProvider + NavMenu), app/routes/auth.$.tsx,
app/routes/webhooks.*.tsx, shopify.app.toml, .gitignore, .env.example.

Every file must be COMPLETE and runnable on \`shopify app dev\`. No TODOs, no stubs, no placeholders. Prefer fewer complete files over many incomplete ones.`;

const TOOL_PROJECT: AITool = {
  name: "emit_shopify_project",
  description: "Emit the merchant-specific app files.",
  parameters: {
    type: "object",
    properties: {
      appName: { type: "string" },
      summary: { type: "string" },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" } },
          required: ["path", "content"],
        },
        description: "10-18 app-specific files.",
      },
    },
    required: ["appName", "summary", "files"],
  },
};

// ─── Reviewer ──────────────────────────────────────────────────────────────
const REVIEWER_PROMPT = `You are a Built for Shopify reviewer. Score the generated embedded app 0-100 across:
- Auth correctness: every loader/action calls authenticate.admin (no unauthenticated data access)
- Polaris compliance: UI uses Polaris components, no raw HTML layout / inline styles
- Admin API usage: store data fetched via admin.graphql, not hardcoded
- Scope minimization: only necessary scopes, protected-data scopes justified
- Completeness: every planned screen implemented with real behavior + empty states
- Prisma correctness: Session model present, app data scoped by shop

If score < 70, list the worst issues. Call emit_shopify_review.`;

const TOOL_REVIEW: AITool = {
  name: "emit_shopify_review",
  description: "Emit the review.",
  parameters: {
    type: "object",
    properties: {
      score: { type: "number" },
      verdict: { type: "string", description: "pass | needs_refinement" },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: { file: { type: "string" }, severity: { type: "string" }, message: { type: "string" }, fix: { type: "string" } },
          required: ["severity", "message"],
        },
      },
    },
    required: ["score", "verdict", "issues"],
  },
};

const TOOL_PATCH: AITool = {
  name: "emit_shopify_patch",
  description: "Emit patched files to fix review issues.",
  parameters: {
    type: "object",
    properties: {
      files: {
        type: "array",
        items: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      },
    },
    required: ["files"],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function sseEvent(type: string, payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...payload })}\n\n`;
}

interface ProjectFile { path: string; content: string }
interface ShopifyProject { appName: string; summary: string; files: ProjectFile[] }

function validateProject(project: ShopifyProject): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byPath = new Map(project.files.map((f) => [f.path, f.content]));

  for (const req of ["prisma/schema.prisma", "app/routes/app._index.tsx"]) {
    if (!byPath.has(req)) errors.push(`Missing required file: ${req}`);
  }

  const schema = byPath.get("prisma/schema.prisma") ?? "";
  if (schema && !/model\s+Session\s*\{/.test(schema)) {
    errors.push("prisma/schema.prisma is missing the required Session model.");
  }

  // Every app route should authenticate before touching store data.
  for (const f of project.files) {
    if (/^app\/routes\/app\..*\.tsx$/.test(f.path)) {
      if ((/export\s+(const|async\s+function)\s+loader/.test(f.content) || /export\s+(const|async\s+function)\s+action/.test(f.content))
        && !/authenticate\.admin\s*\(/.test(f.content)) {
        warnings.push(`${f.path}: loader/action does not call authenticate.admin`);
      }
    }
    if (/\bTODO\b|placeholder|not implemented/i.test(f.content)) {
      warnings.push(`${f.path}: may contain placeholder/TODO content`);
    }
  }
  return { errors, warnings };
}

async function callWithFallback(opts: {
  provider: Provider; apiKey: string; model: string; system: string; userMessage: string;
  tool?: AITool; maxTokens?: number; timeoutMs?: number;
  enqueue?: (type: string, payload: Record<string, unknown>) => void;
}): Promise<{ text?: string; toolArgs?: Record<string, unknown> }> {
  const onRetry: AICallOptions["onRetry"] = (attempt, max, delay, err) => {
    opts.enqueue?.("progress", { phase: "retrying", message: `Retry ${attempt}/${max} after ${Math.round(delay / 1000)}s — ${err.message.slice(0, 80)}`, percent: -1 });
  };
  const base = {
    provider: opts.provider, apiKey: opts.apiKey, system: opts.system, userMessage: opts.userMessage,
    tool: opts.tool, maxTokens: opts.maxTokens ?? 65536, timeoutMs: opts.timeoutMs ?? 300_000, onRetry,
  };
  try {
    return await callAI({ ...base, model: opts.model });
  } catch (err) {
    if (err instanceof AIError && err.retryable) {
      const fallback = FALLBACK_MODELS[opts.provider]?.engineer ?? opts.model;
      opts.enqueue?.("progress", { phase: "retrying", message: `Primary model failed, falling back to ${fallback}…`, percent: -1 });
      return await callAI({ ...base, model: fallback });
    }
    throw err;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = clientIp(req);
  if (isBurstLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute before trying again." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  let body: { prompt?: string; provider?: Provider };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const { prompt, provider: providerHint } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return new Response(JSON.stringify({ error: "Describe the Shopify app you want to build (min 5 chars)." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provider: Provider = (providerHint === "anthropic" || providerHint === "opencode") ? providerHint : "gemini";

  const supabase = adminClient();
  const userId = await resolveUserId(req);
  let userPlan = "free";
  let ipHash: string | null = null;

  if (userId) {
    const quota = await checkUserQuota(supabase, userId);
    userPlan = quota.plan;
    if (!quota.allowed) {
      return new Response(JSON.stringify({ error: `Monthly limit reached (${quota.used}/${quota.limit} builds). Upgrade your plan at /pricing.` }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    ipHash = await hashIp(ip);
    const anon = await checkAnonQuota(supabase, ipHash);
    if (!anon.allowed) {
      return new Response(JSON.stringify({ error: "Free trial used. Sign in to get more builds." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!providerAllowed(provider, userPlan)) {
    return new Response(JSON.stringify({ error: `${provider === "anthropic" ? "Claude" : "Opencode Zen"} requires the Studio plan. Upgrade at /pricing.` }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: `${provider} API key not configured.` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const models = DEFAULT_MODELS[provider];
  const modelUsed = models.engineer;
  const costEstimate = provider === "anthropic" ? 0.30 : provider === "opencode" ? 0.25 : 0.20;
  const tag = `[${provider}]`;

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (type: string, payload: Record<string, unknown>) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(type, payload)));

      try {
        // Phase 1: Architect
        enqueue("progress", { phase: "analyzing", message: `${tag} architect — designing Shopify app…`, percent: 5 });
        const architect = await callWithFallback({
          provider, apiKey, model: models.architect, system: ARCHITECT_PROMPT,
          userMessage: `Design a Shopify embedded admin app for this merchant idea:\n\n"${prompt}"`,
          tool: TOOL_PLAN, maxTokens: 8192, timeoutMs: 120_000, enqueue,
        });
        const plan = architect.toolArgs;
        if (!plan) throw new Error("Architect did not return a plan.");

        const scopes = (plan.scopes as string[]) ?? [];
        const protectedScopes = scopes.filter(isProtectedScope);
        enqueue("progress", {
          phase: "analyzing",
          message: `${tag} plan: "${plan.appName}" — ${(plan.screens as unknown[])?.length ?? 0} screens · ${scopes.length} scopes${protectedScopes.length ? ` (⚠ protected: ${protectedScopes.join(", ")})` : ""}`,
          percent: 25,
        });

        // Stream scaffold immediately
        const scaffoldFiles = getShopifyScaffoldFiles(plan as Record<string, unknown>);
        for (const f of scaffoldFiles) enqueue("file", { path: f.path, content: f.content, phase: "scaffold" });
        enqueue("progress", { phase: "generating", message: `${tag} scaffold ready (${scaffoldFiles.length} files) — engineer writing app code…`, percent: 35 });

        // Phase 2: Engineer
        const patternGuide = getSelectedPolarisPatterns((plan.polarisPatterns as string[]) ?? []);
        const engineerMsg = `Merchant idea: "${prompt}"\n\nArchitect's plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\n${patternGuide}\n\nAdmin API version: ${ADMIN_API_VERSION}.\n\nBuild the merchant-specific files. Implement every screen in the plan. Scaffold files are pre-injected — do NOT regenerate them.`;
        const engineer = await callWithFallback({
          provider, apiKey, model: models.engineer, system: ENGINEER_PROMPT,
          userMessage: engineerMsg, tool: TOOL_PROJECT, maxTokens: 65536, timeoutMs: 300_000, enqueue,
        });
        const raw = engineer.toolArgs as unknown as ShopifyProject | undefined;
        if (!raw?.files?.length) throw new Error("Engineer did not return a project.");

        for (const f of raw.files) enqueue("file", { path: f.path, content: f.content, phase: "engineer" });

        // Merge: scaffold wins on plumbing paths, engineer wins on everything else.
        const reserved = scaffoldPaths(plan as Record<string, unknown>);
        const engineerFiles = raw.files.filter((f) => !reserved.has(f.path));
        const engineerPaths = new Set(engineerFiles.map((f) => f.path));
        const merged = [
          ...scaffoldFiles.filter((f) => !engineerPaths.has(f.path)),
          ...engineerFiles,
        ];
        const project: ShopifyProject = { appName: raw.appName ?? (plan.appName as string), summary: raw.summary ?? "", files: merged };

        const validation = validateProject(project);
        if (validation.errors.length) {
          enqueue("progress", { phase: "generating", message: `${tag} validation: ${validation.errors.join("; ")}`, percent: 60 });
        }

        enqueue("progress", { phase: "bundling", message: `${tag} app built: ${project.files.length} files`, percent: 85 });

        const resultProject = {
          ...project,
          plan,
          bundleId: `shopify.${(plan.appName as string ?? "app").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          target: "shopify",
        };
        enqueue("result", { project: resultProject });
        enqueue("progress", { phase: "done", message: `${tag} Shopify app ready — run \`shopify app dev\` to install`, percent: 100 });

        // Persist usage (meters next request's quota) / record anon trial.
        if (userId) {
          await recordGeneration(supabase, {
            user_id: userId, prompt, app_name: project.appName, bundle_id: resultProject.bundleId,
            summary: project.summary, files: project.files, files_count: project.files.length,
            status: "success", model_used: modelUsed, cost_usd: costEstimate, target: "shopify",
          });
        } else if (ipHash) {
          await recordAnonGeneration(supabase, ipHash);
        }

        // Deferred review + single refinement pass (cost-capped).
        try {
          const manifest = project.files.slice(0, 12).map((f) => `// === ${f.path} ===\n${f.content.slice(0, 1500)}`).join("\n\n");
          const reviewer = await callWithFallback({
            provider, apiKey, model: models.reviewer, system: REVIEWER_PROMPT,
            userMessage: `Review this Shopify embedded app:\n\n${manifest}`,
            tool: TOOL_REVIEW, maxTokens: 4000, timeoutMs: 60_000, enqueue,
          });
          const review = reviewer.toolArgs as { score: number; verdict: string; issues: { file?: string; message?: string; fix?: string }[] } | undefined;
          if (review) {
            enqueue("progress", { phase: "reviewing", message: `[reviewer] Built for Shopify score: ${review.score}/100 — ${review.verdict}`, percent: -1 });
            if (review.score < 70) {
              const topIssues = (review.issues ?? []).slice(0, 4).map((i) => `• [${i.file ?? "general"}] ${i.message ?? ""}${i.fix ? `\n  Fix: ${i.fix}` : ""}`).join("\n");
              const refiner = await callWithFallback({
                provider, apiKey, model: models.engineer, system: ENGINEER_PROMPT,
                userMessage: `The app scored ${review.score}/100. Fix these issues:\n${topIssues}\n\nCurrent files:\n${manifest}\n\nReturn only the PATCHED files.`,
                tool: TOOL_PATCH, maxTokens: 32000, timeoutMs: 120_000, enqueue,
              });
              const patches = refiner.toolArgs?.files as ProjectFile[] | undefined;
              if (patches?.length) {
                const files = [...project.files];
                for (const p of patches) {
                  if (reserved.has(p.path)) continue;
                  const idx = files.findIndex((f) => f.path === p.path);
                  if (idx >= 0) files[idx] = p; else files.push(p);
                }
                enqueue("patch", { files, reviewScore: review.score, autoRefined: true, beforeScore: review.score });
              }
            } else {
              enqueue("review", { reviewScore: review.score });
            }
          }
        } catch (e) {
          console.error("Shopify review error (non-fatal):", e);
        }

        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = e instanceof AIError ? e.message : (e instanceof Error ? e.message : "Generation failed");
        if (userId) {
          await recordGeneration(supabase, { user_id: userId, prompt, status: "failed", model_used: modelUsed, target: "shopify" });
        }
        enqueue("error", { message: msg });
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
});
