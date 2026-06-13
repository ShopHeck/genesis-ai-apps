// Generates an App Store submission kit (STORE_LISTING.md) from the plan, so a
// merchant/partner has a pre-filled listing draft + review checklist in the
// project. Pure — derived entirely from the architect's plan + compliance.

import { isProtectedScope } from "../_shared/shopify.ts";
import type { ComplianceReport } from "./compliance.ts";

interface Screen { name?: string; purpose?: string }
interface Billing { model?: string; priceUsd?: number; trialDays?: number }

export function buildSubmissionKit(
  plan: Record<string, unknown>,
  compliance: ComplianceReport,
): { path: string; content: string } {
  const appName = String(plan.appName ?? "Your App");
  const tagline = String(plan.tagline ?? "");
  const signature = String(plan.signatureFeature ?? "");
  const scopes = Array.isArray(plan.scopes) ? (plan.scopes as string[]) : [];
  const screens = Array.isArray(plan.screens) ? (plan.screens as Screen[]) : [];
  const billing = (plan.billing ?? {}) as Billing;
  const justification = String(plan.scopeJustification ?? "").trim();
  const protectedScopes = scopes.filter(isProtectedScope);

  const features = screens
    .filter((s) => s?.name)
    .map((s) => `- **${s.name}** — ${s.purpose ?? ""}`.trimEnd())
    .join("\n") || "- _List your app's key features here._";

  const pricing = billing.model === "recurring"
    ? `Recurring — $${billing.priceUsd ?? "?"}/month${billing.trialDays ? ` · ${billing.trialDays}-day free trial` : ""}`
    : billing.model === "one_time"
      ? `One-time — $${billing.priceUsd ?? "?"}`
      : "Free";

  const scopeRows = scopes.length
    ? scopes.map((s) => `| \`${s}\` | ${isProtectedScope(s) ? "⚠️ Protected" : "Standard"} |`).join("\n")
    : "| _none_ | |";

  const check = (ok: boolean) => (ok ? "x" : " ");
  const byId = new Map(compliance.checks.map((c) => [c.id, c]));
  const passed = (id: string) => byId.get(id)?.passed ?? false;

  const content = `# ${appName} — App Store submission kit

> Auto-generated draft. Review and complete every section before submitting to the
> Shopify App Store. Compliance score at generation: **${compliance.score}/100**.

## Listing

- **App name:** ${appName}
- **Tagline:** ${tagline || "_Add a one-line pitch (max 62 chars)._"}
- **Pricing:** ${pricing}

### Description
${signature || "_Describe the problem you solve and the outcome for the merchant._"}

### Key features
${features}

## Access scopes

| Scope | Type |
|-------|------|
${scopeRows}

**Why these scopes are needed:**
${justification || "_Justify each requested scope. Reviewers reject apps that over-request._"}

${protectedScopes.length ? `> ⚠️ This app requests **protected customer data** (${protectedScopes.join(", ")}). You must complete the [Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data) form and keep a data-protection rationale.` : "> This app does not request protected customer data."}

## Pre-submission checklist

- [${check(passed("session_model"))}] Sessions persisted (Prisma Session model)
- [${check(passed("auth_on_routes"))}] Every route authenticates before accessing store data
- [${check(passed("uninstall_webhook"))}] app/uninstalled webhook handled
- [${check(passed("privacy_webhooks"))}] Mandatory privacy/compliance webhooks implemented
- [${check(passed("polaris_ui"))}] UI built with Polaris (matches the admin)
- [${check(passed("admin_api_usage"))}] Uses the Admin GraphQL API for store data
- [${check(passed("no_placeholders"))}] No placeholder/TODO content
- [ ] App icon (1200×1200) and at least 3 screenshots prepared
- [ ] App listing URLs set (app URL, privacy policy, support email)
- [ ] Tested install/uninstall on a development store
- [ ] Billing API charges created (if paid)

See the full [App Store requirements](https://shopify.dev/docs/apps/launch/app-store-review/requirements).
`;

  return { path: "STORE_LISTING.md", content };
}
