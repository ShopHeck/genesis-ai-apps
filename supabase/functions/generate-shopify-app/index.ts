// Shopify App Generation Pipeline
// Produces an installable, Built-for-Shopify-minded embedded admin app on the
// official React Router template (@shopify/shopify-app-react-router + Polaris).
// Architect → Engineer → Reviewer, streamed over SSE, metered through the
// shared quota module. The scaffold (OAuth/session/webhooks/billing plumbing)
// is injected; the AI spends its budget on merchant-specific value.

import { callAI, AIError, AITool, DEFAULT_MODELS, FALLBACK_MODELS, getApiKey, Provider, type AICallOptions } from "../_shared/ai.ts";
import {
  adminClient, resolveUserId, clientIp, hashIp,
  checkUserQuota, checkAnonQuota, checkMonthlySpend, recordGeneration, recordAnonGeneration, isBurstLimited,
} from "../_shared/quota.ts";
import { providerAllowed } from "../_shared/plan-limits.ts";
import { COMMON_SCOPES, isProtectedScope, ADMIN_API_VERSION, FORBIDDEN_IMPORT_SPECS, findForbiddenImports } from "../_shared/shopify.ts";
import {
  getShopifyScaffoldFiles, getSelectedPolarisPatterns, scaffoldPaths,
  getAdminExtensionFiles, normalizeAdminBlock, ADMIN_EXTENSION_TARGETS,
  POLARIS_PATTERN_MENU,
} from "./scaffold.ts";
import { getValidatedOperations, ADMIN_OPERATION_MENU } from "./graphql-operations.ts";
import { runCompliance, complianceSummary } from "./compliance.ts";
import { buildSubmissionKit } from "./submission-kit.ts";
import { fetchStoreContext, storeContextPrompt } from "../_shared/shopify-admin.ts";
import { createLogger } from "../_shared/log.ts";
import { CostGuard, CostLimitError, defaultMaxCost, type Role } from "../_shared/cost.ts";

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

For graphqlOperations, PREFER these validated Admin API root fields whenever they fit the app — the engineer will be given the exact, schema-validated operation for each:
${ADMIN_OPERATION_MENU}

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
      includeAdminBlock: { type: "boolean", description: `Set true to ALSO surface app data directly on an admin resource page via an Admin UI extension. Use when the app's value benefits from appearing on the product/order/customer detail page.` },
      adminBlock: {
        type: "object",
        description: "Admin UI extension spec (only when includeAdminBlock is true).",
        properties: {
          name: { type: "string" },
          handle: { type: "string", description: "kebab-case, e.g. low-stock-block" },
          target: { type: "string", description: `One of: ${ADMIN_EXTENSION_TARGETS.join(", ")}` },
          purpose: { type: "string" },
        },
      },
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
3. ALL store data comes from the Admin GraphQL API via \`admin.graphql(\`#graphql ...\`, { variables })\` inside loaders/actions — never hardcode catalog data.
4. UI uses ONLY @shopify/polaris components (Page, Card, Layout, IndexTable, BlockStack, Text, Button, etc.). No raw HTML layout, no inline styles, no Tailwind.
5. App-owned data uses Prisma, always scoped by \`shop\` (from session.shop).
6. Mutations/forms use React Router <Form>/useFetcher + route actions. Show the App Bridge save bar for dirty forms.
7. Provide an empty state for every index/list screen.
8. Follow the Polaris pattern recipes provided.
9. IMPORT WHITELIST — this template installs ONLY these packages, so every import you write MUST come from exactly them:
   react, react-dom, react-router, @react-router/node, @react-router/serve, @react-router/fs-routes,
   @react-router/dev, @shopify/polaris, @shopify/app-bridge-react, @shopify/shopify-app-react-router,
   @shopify/shopify-app-session-storage-prisma, @prisma/client, prisma, isbot,
   @types/react, @types/react-dom, @types/node (type-only), plus relative imports (../, ./).
   FORBIDDEN — these are NOT installed and will break \`shopify app dev\` with a module-not-found error. NEVER import them: ${FORBIDDEN_IMPORT_SPECS.join(", ")}.
   Use \`import { authenticate } from "../shopify.server"\` (already injected) — do NOT import a separate session/authenticator.

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

# PRODUCTION QUALITY — your output ships to real merchants, so:
- Every screen you emit is a COMPLETE, polished Polaris page driven by a real loader: it fetches data, renders it, AND handles loading (Skeleton/Spinner), empty, and error states. Never a static shell, a "coming soon" placeholder, or a screen that renders nothing.
- The loader's returned data is actually rendered — no dead code, no unused variables, no screen that fetches data and ignores it.
- Mutations write via route actions + useFetcher/<Form> and then invalidate/revalidate the loader so the UI reflects the change immediately.
- Prefer 3-5 fully polished screens over many thin ones. A tight, complete app beats a broad, half-finished one — the reviewer checks that every planned screen is implemented with real behavior.
- No console.log, no debugger, no commented-out code left in the deliverable.

Every file must be COMPLETE and runnable on \`shopify app dev\`. No TODOs, no stubs, no placeholders.`;

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
const REVIEWER_PROMPT = `You are the final Built for Shopify reviewer before a generated app ships to a real merchant. Judge whether it is PRODUCTION-READY — something an installed merchant could rely on today — not merely "well-formed."

Score 0-100, strict. A merchant-facing defect (broken screen, dead data, no empty state, unauthenticated data access, non-compiling import) is a failure, not a nit.

Weighted dimensions:
- Auth correctness (20): every loader/action calls authenticate.admin; zero unauthenticated data access.
- Real screen behavior (25): every planned screen renders loader-driven data with loading, empty, and error states; mutations round-trip and revalidate; no hardcoded store data, no dead/ignored data, no "coming soon" shells.
- Polaris/UI completeness (15): Polaris-only, no inline styles/raw HTML, consistent spacing, usable empty states.
- Data correctness (20): Admin GraphQL operations correct and typed; Prisma models include the Session model and are scoped by shop; no undefined queries.
- Scope minimization (10): minimal scopes, protected-data scopes justified.
- Build cleanliness (10): no non-installed imports (@remix-run/*, @shopify/shopify-app-remix/*, bare @shopify/app-bridge), TypeScript strict, no TODOs/stubs/console.log.

You will be given the deterministic compliance score — do NOT contradict it on the structural checks it already verified; ADD the deeper production-readiness judgment it cannot see (real behavior, completeness, polish).

Thresholds:
- >= 70 -> verdict "pass" (merchant-ready).
- < 70 -> verdict "needs_refinement" and list the 3-5 HIGHEST-IMPACT fixes only. For each: exact file path, severity (error|warning), a one-line message, and a concrete fix the engineer can apply directly. The refiner patches exactly these files.

Call emit_shopify_review with { score, verdict, issues }.`;

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

function validateProject(project: ShopifyProject, plan?: Record<string, unknown>): { errors: string[]; warnings: string[] } {
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

  // Production-completeness: a bloated plan that produces truncated screens is the
  // single biggest quality failure, so compare the plan's screen count against the
  // number of app route files that actually came back. Count-based (not exact path)
  // so a sensible file rename doesn't falsely fail the build; a big shortfall is a
  // real "the app is half-built" signal.
  const plannedScreens = Array.isArray(plan?.screens) ? (plan.screens as { route?: string; name?: string }[]) : [];
  if (plannedScreens.length > 0) {
    const implementedRoutes = project.files.filter((f) => /^app\/routes\/app\..*\.tsx$/.test(f.path)).map((f) => f.path);
    if (implementedRoutes.length < plannedScreens.length) {
      warnings.push(`Completeness: plan declares ${plannedScreens.length} screen(s) but ${implementedRoutes.length} app route file(s) were generated — screens may be missing`);
    }
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
    // Screen routes must actually render — a route with no default component is dead UI.
    if (/^app\/routes\/app\..*\.tsx$/.test(f.path) && !/export\s+default\s+(?:async\s+)?function/.test(f.content)) {
      warnings.push(`${f.path}: screen route has no default-exported component (won't render)`);
    }
    // Production hygiene: no debug prints left in a merchant-facing deliverable.
    if (/\bconsole\.(log|debug|info)\b|\bdebugger\b/.test(f.content)) {
      warnings.push(`${f.path}: contains console.log/debugger — remove for production`);
    }
    // Compile-viability hard gate: the react-router template installs only the
    // whitelisted packages; a legacy Remix/AppBridge import breaks `shopify app dev`.
    const forbidden = findForbiddenImports(f.content);
    if (forbidden.length) {
      errors.push(`${f.path}: imports non-installed package (${forbidden.join(", ")}) — will not compile; use ${FORBIDDEN_IMPORT_SPECS.length} whitelisted packages`);
    }
  }
  return { errors, warnings };
}

async function callWithFallback(opts: {
  provider: Provider; apiKey: string; model: string; system: string; userMessage: string;
  role: Role; costGuard?: CostGuard;
  tool?: AITool; maxTokens?: number; timeoutMs?: number;
  enqueue?: (type: string, payload: Record<string, unknown>) => void;
}): Promise<{ text?: string; toolArgs?: Record<string, unknown> }> {
  // Charge the cost ceiling before spending on the call (throws CostLimitError).
  opts.costGuard?.charge(opts.provider, opts.role);
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

  // Monthly AI spend cap (cost guard). Blocks before any model call so a
  // subscriber can't run an unbounded monthly bill, regardless of build quota.
  if (userId) {
    const est = provider === "anthropic" ? 0.30 : provider === "opencode" ? 0.25 : 0.20;
    const spend = await checkMonthlySpend(supabase, userId, userPlan, est);
    if (!spend.allowed) {
      return new Response(JSON.stringify({ error: `Monthly AI spend cap reached ($${spend.spent.toFixed(2)} of $${spend.limit}). Upgrade your plan or try again next month.` }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  const tag = `[${provider}]`;
  const log = createLogger("generate-shopify-app");
  const costGuard = new CostGuard(defaultMaxCost());
  const startedAt = Date.now();
  log.info("generation.start", { provider, userId: userId ?? null, anon: !userId, promptChars: prompt.length });

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (type: string, payload: Record<string, unknown>) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(type, payload)));

      try {
        // Ground in the user's connected store, if any.
        let storeContext = "";
        if (userId) {
          const { data: conn } = await supabase
            .from("shopify_connections")
            .select("shop_domain, access_token")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (conn?.shop_domain && conn?.access_token) {
            const ctx = await fetchStoreContext(conn.shop_domain as string, conn.access_token as string);
            if (ctx) {
              storeContext = storeContextPrompt(ctx);
              enqueue("progress", { phase: "analyzing", message: `${tag} grounded in ${ctx.shopName} · ${ctx.productCount} products`, percent: 4 });
            }
          }
        }

        // Phase 1: Architect
        enqueue("progress", { phase: "analyzing", message: `${tag} architect — designing Shopify app…`, percent: 5 });
        const architect = await callWithFallback({
          provider, apiKey, model: models.architect, system: ARCHITECT_PROMPT, role: "architect", costGuard,
          userMessage: `Design a Shopify embedded admin app for this merchant idea:\n\n"${prompt}"${storeContext ? `\n\n${storeContext}` : ""}`,
          tool: TOOL_PLAN, maxTokens: 8192, timeoutMs: 120_000, enqueue,
        });
        const plan = architect.toolArgs;
        if (!plan) throw new Error("Architect did not return a plan.");

        // Ground generation in schema-validated Admin API operations chosen by
        // the architect, and union their scopes into the plan so the generated
        // shopify.app.toml requests exactly what the app uses (still minimal).
        const opChoices = Array.isArray(plan.graphqlOperations)
          ? (plan.graphqlOperations as { rootField?: string }[]).map((o) => o?.rootField ?? "").filter(Boolean)
          : [];
        const validatedOps = getValidatedOperations(opChoices);
        const planScopes = new Set<string>(Array.isArray(plan.scopes) ? plan.scopes as string[] : []);
        for (const s of validatedOps.scopes) planScopes.add(s);
        plan.scopes = [...planScopes];

        const scopes = (plan.scopes as string[]) ?? [];
        const protectedScopes = scopes.filter(isProtectedScope);
        enqueue("progress", {
          phase: "analyzing",
          message: `${tag} plan: "${plan.appName}" — ${(plan.screens as unknown[])?.length ?? 0} screens · ${scopes.length} scopes${protectedScopes.length ? ` (⚠ protected: ${protectedScopes.join(", ")})` : ""}`,
          percent: 25,
        });

        // Stream scaffold immediately (app plumbing + optional admin UI extension).
        const adminBlock = normalizeAdminBlock(plan as Record<string, unknown>);
        const scaffoldFiles = [
          ...getShopifyScaffoldFiles(plan as Record<string, unknown>),
          ...getAdminExtensionFiles(plan as Record<string, unknown>),
        ];
        for (const f of scaffoldFiles) enqueue("file", { path: f.path, content: f.content, phase: "scaffold" });
        enqueue("progress", {
          phase: "generating",
          message: `${tag} scaffold ready (${scaffoldFiles.length} files${adminBlock ? ` · +admin ${adminBlock.target.includes("action") ? "action" : "block"} extension` : ""}) — engineer writing app code…`,
          percent: 35,
        });

        // Phase 2: Engineer
        const patternGuide = getSelectedPolarisPatterns((plan.polarisPatterns as string[]) ?? []);
        const engineerMsg = `Merchant idea: "${prompt}"\n\nArchitect's plan:\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n\n${patternGuide}\n\n${validatedOps.snippets}${storeContext ? `\n\n${storeContext}` : ""}\n\nAdmin API version: ${ADMIN_API_VERSION}.\n\nBuild the merchant-specific files. Implement every screen in the plan. Scaffold files are pre-injected — do NOT regenerate them.`;
        const engineer = await callWithFallback({
          provider, apiKey, model: models.engineer, system: ENGINEER_PROMPT, role: "engineer", costGuard,
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

        const validation = validateProject(project, plan as Record<string, unknown>);
        if (validation.warnings.length) {
          enqueue("progress", { phase: "generating", message: `${tag} validation: ${validation.warnings.join("; ")}`, percent: 60 });
        }
        if (validation.errors.length) {
          enqueue("progress", { phase: "generating", message: `${tag} validation: ${validation.errors.join("; ")}`, percent: 60 });
          // Fail-closed: never deliver an app that won't compile. Disabled the
          // previous behavior where errors were logged but the app was still shipped.
          throw new Error(`Generated app will not compile: ${validation.errors.join("; ")}`);
        }

        // Deterministic Built-for-Shopify compliance gate + submission kit.
        const compliance = runCompliance(project, plan as Record<string, unknown>);
        const kit = buildSubmissionKit(plan as Record<string, unknown>, compliance);
        project.files.push(kit);
        enqueue("progress", { phase: "bundling", message: `${tag} ${complianceSummary(compliance)}`, percent: 90 });
        enqueue("compliance", { compliance });

        enqueue("progress", { phase: "bundling", message: `${tag} app built: ${project.files.length} files`, percent: 95 });

        const resultProject = {
          ...project,
          plan,
          compliance,
          bundleId: `shopify.${(plan.appName as string ?? "app").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          target: "shopify",
        };
        enqueue("result", { project: resultProject });
        enqueue("progress", { phase: "done", message: `${tag} Shopify app ready — run \`shopify app dev\` to install`, percent: 100 });
        log.info("generation.done", {
          appName: project.appName, files: project.files.length,
          complianceScore: compliance.score, estCostUsd: costGuard.total,
          ms: Date.now() - startedAt,
        });

        // Persist usage (meters next request's quota) / record anon trial.
        if (userId) {
          await recordGeneration(supabase, {
            user_id: userId, prompt, app_name: project.appName, bundle_id: resultProject.bundleId,
            summary: project.summary, files: project.files, files_count: project.files.length,
            status: "success", model_used: modelUsed, cost_usd: costGuard.total, target: "shopify",
          });
        } else if (ipHash) {
          await recordAnonGeneration(supabase, ipHash);
        }

        // Deferred review + single refinement pass (cost-capped). The reviewer
        // gets the WHOLE app (not a truncated slice) plus the deterministic
        // compliance result and the merchant's acceptance criteria, so its verdict
        // is aligned and its fixes are concrete. A sub-70 app is then repaired
        // using the FULL content of the exact files the reviewer flagged (a
        // truncated slice is why earlier refines returned nothing), and the
        // patched output is RE-VALIDATED so a regression is never shipped.
        const complianceText = complianceSummary(compliance);
        try {
          const manifest = project.files.map((f) => `// === ${f.path} ===\n${f.content}`).join("\n\n");
          const criteria = (Array.isArray(plan.acceptanceCriteria) ? plan.acceptanceCriteria : []).join("\n- ");
          const reviewer = await callWithFallback({
            provider, apiKey, model: models.reviewer, system: REVIEWER_PROMPT, role: "reviewer", costGuard,
            userMessage:
              `Review this Shopify embedded app:\n\n${manifest}\n\n` +
              `Deterministic Built-for-Shopify readiness (internal check): ${complianceText}\n\n` +
              `Merchant acceptance criteria:\n- ${criteria}\n\n` +
              `Judge PRODUCTION-READINESS. If score < 70, list the 3-5 highest-impact fixes with exact file paths and concrete changes.`,
            tool: TOOL_REVIEW, maxTokens: 6000, timeoutMs: 90_000, enqueue,
          });
          const review = reviewer.toolArgs as { score: number; verdict: string; issues: { file?: string; message?: string; fix?: string }[] } | undefined;
          if (!review) throw new Error("Reviewer returned no verdict.");
          enqueue("progress", { phase: "reviewing", message: `[reviewer] Built-for-Shopify readiness score: ${review.score}/100 — ${review.verdict}`, percent: -1 });

          if (review.score < 70) {
            // Refiner context = FULL content of the files the reviewer flagged,
            // PLUS every screen route, the typed data layer, and the schema — a
            // truncated slice is why earlier refines returned nothing, and fixing
            // a screen usually touches a supporting file too.
            const flagged = (review.issues ?? []).map((i) => i.file).filter(Boolean) as string[];
            const support = project.files
              .filter((f) => /^app\/routes\/app\..*\.tsx$/.test(f.path) || /^app\/lib\//.test(f.path) || f.path === "prisma/schema.prisma")
              .map((f) => f.path);
            const paths = [...new Set([...flagged, ...support])];
            const refContext = paths.map((p) => {
              const f = project.files.find((x) => x.path === p);
              return f ? `// === ${f.path} ===\n${f.content}` : null;
            }).filter(Boolean).join("\n\n");
            const topIssues = (review.issues ?? []).slice(0, 5).map((i) => `• [${i.file ?? "general"}] ${i.message ?? ""}${i.fix ? `\n  Fix: ${i.fix}` : ""}`).join("\n");
            const refiner = await callWithFallback({
              provider, apiKey, model: models.engineer, system: ENGINEER_PROMPT, role: "engineer", costGuard,
              userMessage:
                `The app scored ${review.score}/100 — needs refinement. Fix these issues:\n${topIssues}\n\n` +
                `Full contents of the files to change (only these are shown; keep your changes inside them):\n${refContext}\n\n` +
                `Hard rules still apply — NEVER import ${FORBIDDEN_IMPORT_SPECS.join(", ")}; TypeScript strict; return complete files, not diffs.\n\n` +
                `Return ONLY the fully-patched files that fix the issues. Do not return a file if no change is needed.`,
              tool: TOOL_PATCH, maxTokens: 50000, timeoutMs: 150_000, enqueue,
            });
            const patches = refiner.toolArgs?.files as ProjectFile[] | undefined;
            if (!patches?.length) {
              enqueue("progress", { phase: "reviewing", message: "[refine] refinement produced no changes — delivering the original build", percent: -1 });
            } else {
              const refined = [...project.files];
              for (const p of patches) {
                if (reserved.has(p.path)) continue;
                const idx = refined.findIndex((f) => f.path === p.path);
                if (idx >= 0) refined[idx] = p; else refined.push(p);
              }
              // Re-gate: never emit a patch that regresses compile/validation.
              const refinedProject: ShopifyProject = { appName: project.appName, summary: project.summary, files: refined };
              const reValidation = validateProject(refinedProject, plan as Record<string, unknown>);
              if (reValidation.errors.length) {
                enqueue("progress", { phase: "reviewing", message: `[refine] refinement would break validation (${reValidation.errors.join("; ")}) — keeping the original build`, percent: -1 });
              } else {
                const reCompliance = runCompliance(refinedProject, plan as Record<string, unknown>);
                enqueue("patch", { files: refined, reviewScore: review.score, autoRefined: true, beforeScore: review.score, compliance: reCompliance });
                enqueue("progress", { phase: "reviewing", message: `[refine] ${complianceSummary(reCompliance)}`, percent: -1 });
              }
            }
          } else {
            enqueue("review", { reviewScore: review.score, compliance: compliance });
          }
        } catch (e) {
          log.warn("review.failed", { error: e instanceof Error ? e.message : String(e) });
          enqueue("progress", { phase: "reviewing", message: "[reviewer] advisory review skipped", percent: -1 });
        }

        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = e instanceof CostLimitError
          ? "This request hit the generation cost ceiling. Try a simpler app description."
          : e instanceof AIError ? e.message : (e instanceof Error ? e.message : "Generation failed");
        log.error("generation.error", {
          error: e instanceof Error ? e.message : String(e),
          costLimited: e instanceof CostLimitError, estCostUsd: costGuard.total, ms: Date.now() - startedAt,
        });
        if (userId) {
          await recordGeneration(supabase, { user_id: userId, prompt, status: "failed", model_used: modelUsed, cost_usd: costGuard.total, target: "shopify" });
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
