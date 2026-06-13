// Deterministic Built-for-Shopify compliance checks.
//
// These run over the *actual generated files* (not the LLM's self-assessment),
// so they're a hard gate the model can't talk its way past. Pure functions —
// fully unit-tested in both Deno and Node.

import { isProtectedScope } from "../_shared/shopify.ts";

export type Severity = "error" | "warning" | "info";

export interface ComplianceCheck {
  id: string;
  label: string;
  severity: Severity;
  passed: boolean;
  detail?: string;
}

export interface ComplianceReport {
  score: number;       // 0-100
  passed: boolean;     // true when no error-severity check failed
  checks: ComplianceCheck[];
}

interface ProjectFile { path: string; content: string }

const APP_ROUTE_RE = /^app\/routes\/app\b.*\.tsx$/;
const HAS_LOADER_OR_ACTION_RE = /export\s+(?:const|async\s+function)\s+(?:loader|action)\b/;
const AUTHENTICATE_ADMIN_RE = /authenticate\.admin\s*\(/;
const PLACEHOLDER_RE = /\bTODO\b|\bFIXME\b|placeholder|not\s+implemented/i;
const RAW_STYLE_RE = /style=\{\{/;

export function runCompliance(
  project: { files: ProjectFile[] },
  plan: Record<string, unknown>,
): ComplianceReport {
  const files = project.files ?? [];
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const has = (p: string) => byPath.has(p);
  const checks: ComplianceCheck[] = [];

  // 1. Prisma Session model present.
  const schema = byPath.get("prisma/schema.prisma") ?? "";
  checks.push({
    id: "session_model",
    label: "Prisma Session model present",
    severity: "error",
    passed: /model\s+Session\s*\{/.test(schema),
    detail: schema ? undefined : "prisma/schema.prisma is missing",
  });

  // 2. Every app route with a loader/action authenticates.
  const appRoutes = files.filter((f) => APP_ROUTE_RE.test(f.path) && f.path !== "app/routes/app.tsx");
  const unauthed = appRoutes
    .filter((f) => HAS_LOADER_OR_ACTION_RE.test(f.content) && !AUTHENTICATE_ADMIN_RE.test(f.content))
    .map((f) => f.path);
  checks.push({
    id: "auth_on_routes",
    label: "Every route authenticates before accessing store data",
    severity: "error",
    passed: unauthed.length === 0,
    detail: unauthed.length ? `Missing authenticate.admin in: ${unauthed.join(", ")}` : undefined,
  });

  // 3. App-uninstalled webhook handler present.
  checks.push({
    id: "uninstall_webhook",
    label: "app/uninstalled webhook handled",
    severity: "error",
    passed: has("app/routes/webhooks.app.uninstalled.tsx"),
  });

  // 4. Mandatory privacy/compliance webhooks present.
  const privacyRoutes = [
    "app/routes/webhooks.customers.data_request.tsx",
    "app/routes/webhooks.customers.redact.tsx",
    "app/routes/webhooks.shop.redact.tsx",
  ];
  const missingPrivacy = privacyRoutes.filter((p) => !has(p));
  checks.push({
    id: "privacy_webhooks",
    label: "Mandatory privacy/compliance webhooks present",
    severity: "error",
    passed: missingPrivacy.length === 0,
    detail: missingPrivacy.length ? `Missing: ${missingPrivacy.join(", ")}` : undefined,
  });

  // 5. UI routes use Polaris (not raw HTML/inline styles).
  const uiRoutes = appRoutes.filter((f) => /export\s+default\s+function/.test(f.content));
  const nonPolaris = uiRoutes.filter((f) => !/@shopify\/polaris/.test(f.content)).map((f) => f.path);
  const inlineStyled = uiRoutes.filter((f) => RAW_STYLE_RE.test(f.content)).map((f) => f.path);
  checks.push({
    id: "polaris_ui",
    label: "Screens built with Polaris (no inline styles)",
    severity: "warning",
    passed: nonPolaris.length === 0 && inlineStyled.length === 0,
    detail: [
      nonPolaris.length ? `No Polaris import: ${nonPolaris.join(", ")}` : "",
      inlineStyled.length ? `Inline styles: ${inlineStyled.join(", ")}` : "",
    ].filter(Boolean).join("; ") || undefined,
  });

  // 6. At least one route reads store data via the Admin API.
  const usesAdminApi = files.some((f) => /admin\.graphql\s*\(/.test(f.content));
  checks.push({
    id: "admin_api_usage",
    label: "Reads store data via the Admin GraphQL API",
    severity: "warning",
    passed: usesAdminApi,
    detail: usesAdminApi ? undefined : "No admin.graphql(...) call found",
  });

  // 7. No placeholders / TODO stubs.
  const withPlaceholders = files
    .filter((f) => f.path.endsWith(".tsx") || f.path.endsWith(".ts"))
    .filter((f) => PLACEHOLDER_RE.test(f.content))
    .map((f) => f.path);
  checks.push({
    id: "no_placeholders",
    label: "No TODO/placeholder stubs",
    severity: "warning",
    passed: withPlaceholders.length === 0,
    detail: withPlaceholders.length ? `Found in: ${withPlaceholders.slice(0, 5).join(", ")}` : undefined,
  });

  // 8. Protected-data scopes are justified.
  const scopes = Array.isArray(plan.scopes) ? (plan.scopes as string[]) : [];
  const protectedScopes = scopes.filter(isProtectedScope);
  const justification = String(plan.scopeJustification ?? "").toLowerCase();
  const unjustified = protectedScopes.filter((s) => !justification.includes(s.toLowerCase()));
  checks.push({
    id: "protected_data_justified",
    label: "Protected-data scopes are justified",
    severity: protectedScopes.length ? "warning" : "info",
    passed: unjustified.length === 0,
    detail: unjustified.length ? `No stated justification for: ${unjustified.join(", ")}` : undefined,
  });

  // Score: errors weigh heaviest, warnings moderate, info none.
  const WEIGHT: Record<Severity, number> = { error: 22, warning: 8, info: 0 };
  let score = 100;
  for (const c of checks) if (!c.passed) score -= WEIGHT[c.severity];
  score = Math.max(0, Math.min(100, score));
  const passed = checks.every((c) => c.severity !== "error" || c.passed);

  return { score, passed, checks };
}

// Compact one-line summary for the generation stream.
export function complianceSummary(report: ComplianceReport): string {
  const failed = report.checks.filter((c) => !c.passed);
  if (failed.length === 0) return `Built for Shopify: ${report.score}/100 · all checks passed`;
  const errs = failed.filter((c) => c.severity === "error").length;
  const warns = failed.filter((c) => c.severity === "warning").length;
  return `Built for Shopify: ${report.score}/100 · ${errs} error(s), ${warns} warning(s)`;
}
