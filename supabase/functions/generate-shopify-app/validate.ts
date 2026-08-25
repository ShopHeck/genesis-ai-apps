// Deterministic production gate for a generated Shopify app. This is the
// fail-closed check that runs BEFORE an app is delivered — it must pass for the
// generation to succeed. Kept in its own module (no Deno globals) so it is
// fully unit-testable under Vitest/Node.
import { scaffoldPaths } from "./scaffold.ts";
import { findForbiddenImports, FORBIDDEN_IMPORT_SPECS } from "../_shared/shopify.ts";

export interface ProjectFile { path: string; content: string }
export interface ShopifyProject { appName: string; summary: string; files: ProjectFile[] }

export function validateProject(project: ShopifyProject, plan?: Record<string, unknown>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byPath = new Map(project.files.map((f) => [f.path, f.content]));
  // Pre-injected plumbing (webhooks, shell, shopify.server, etc.) is OUR code, not
  // the engineer's — hygiene checks must not flag it (e.g. webhook handlers log
  // legitimately). Only engineer-generated files get the production-quality scan.
  const reserved = scaffoldPaths(plan ?? {});

  for (const req of ["prisma/schema.prisma", "app/routes/app._index.tsx"]) {
    if (!byPath.has(req)) errors.push(`Missing required file: ${req}`);
  }

  const schema = byPath.get("prisma/schema.prisma") ?? "";
  if (schema && !/model\s+Session\s*\{/.test(schema)) {
    errors.push("prisma/schema.prisma is missing the required Session model.");
  }

  // Production-completeness (fail-closed): a bloated plan that produces truncated
  // screens is the single biggest quality failure. If the plan declares N screens
  // but fewer app route files came back, that is a half-built app — reject it so
  // it is never delivered as "ready."
  const plannedScreens = Array.isArray(plan?.screens) ? (plan.screens as { route?: string; name?: string }[]) : [];
  const screenRoutes = project.files
    .filter((f) => /^app\/routes\/app\..*\.tsx$/.test(f.path) && f.path !== "app/routes/app.tsx" && !reserved.has(f.path))
    .map((f) => f.path);
  if (plannedScreens.length > 0 && screenRoutes.length < plannedScreens.length) {
    errors.push(`Completeness: plan declares ${plannedScreens.length} screen(s) but only ${screenRoutes.length} route file(s) were generated — the app is incomplete`);
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
    if (/^app\/routes\/app\..*\.tsx$/.test(f.path) && f.path !== "app/routes/app.tsx" && !reserved.has(f.path) && !/export\s+default\s+(?:async\s+)?function/.test(f.content)) {
      warnings.push(`${f.path}: screen route has no default-exported component (won't render)`);
    }
    // Production hygiene (engineer code only, not the pre-injected scaffold):
    if (!reserved.has(f.path)) {
      // No debug prints left in a merchant-facing deliverable.
      if (/\bconsole\.(log|debug|info)\b|\bdebugger\b/.test(f.content)) {
        warnings.push(`${f.path}: contains console.log/debugger — remove for production`);
      }
      // The template ships TypeScript strict; `any` defeats it and is a real signal.
      if (/(?:\bas\s+any\b|<any>|:\s*any\b|Array<any>)/.test(f.content)) {
        warnings.push(`${f.path}: uses \`any\` — type it (no-explicit-any)`);
      }
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
