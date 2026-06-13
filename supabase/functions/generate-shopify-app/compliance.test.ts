import { describe, it, expect } from "vitest";
import { runCompliance, complianceSummary } from "./compliance";
import { buildSubmissionKit } from "./submission-kit";
import { getShopifyScaffoldFiles } from "./scaffold";

// A compliant project: scaffold plumbing + an authenticated Polaris route that
// hits the Admin API + a Prisma schema with the Session model.
function compliantProject(extraScopes: string[] = []) {
  const plan = {
    appName: "Stock Watch",
    scopes: ["read_products", ...extraScopes],
    scopeJustification: extraScopes.map((s) => `${s}: needed`).join("; "),
  };
  const files = [
    ...getShopifyScaffoldFiles(plan),
    {
      path: "prisma/schema.prisma",
      content: "datasource db {}\nmodel Session { id String @id\n shop String }",
    },
    {
      path: "app/routes/app._index.tsx",
      content: `import { Page, Card } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const r = await admin.graphql("#graphql\\nquery { products(first: 1) { edges { node { id } } } }");
  return r;
};
export default function Index() { return <Page><Card>hi</Card></Page>; }`,
    },
  ];
  return { project: { files }, plan };
}

describe("runCompliance", () => {
  it("passes a well-formed app with a high score", () => {
    const { project, plan } = compliantProject();
    const report = runCompliance(project, plan);
    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.checks.find((c) => c.id === "session_model")?.passed).toBe(true);
    expect(report.checks.find((c) => c.id === "auth_on_routes")?.passed).toBe(true);
    expect(report.checks.find((c) => c.id === "privacy_webhooks")?.passed).toBe(true);
  });

  it("fails (error) when a route accesses data without authenticate.admin", () => {
    const { project, plan } = compliantProject();
    project.files.push({
      path: "app/routes/app.reports.tsx",
      content: `import { Page } from "@shopify/polaris";
export const loader = async () => ({ ok: true });
export default function R() { return <Page>r</Page>; }`,
    });
    const report = runCompliance(project, plan);
    const check = report.checks.find((c) => c.id === "auth_on_routes")!;
    expect(check.passed).toBe(false);
    expect(check.detail).toContain("app/routes/app.reports.tsx");
    expect(report.passed).toBe(false); // error severity blocks
  });

  it("fails when the Session model is missing", () => {
    const { project, plan } = compliantProject();
    const idx = project.files.findIndex((f) => f.path === "prisma/schema.prisma");
    project.files[idx] = { path: "prisma/schema.prisma", content: "datasource db {}" };
    const report = runCompliance(project, plan);
    expect(report.checks.find((c) => c.id === "session_model")?.passed).toBe(false);
    expect(report.passed).toBe(false);
  });

  it("warns (not errors) on inline styles and missing Polaris", () => {
    const { project, plan } = compliantProject();
    project.files.push({
      path: "app/routes/app.bad.tsx",
      content: `import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => { await authenticate.admin(request); return null; };
export default function Bad() { return <div style={{ color: "red" }}>x</div>; }`,
    });
    const report = runCompliance(project, plan);
    const polaris = report.checks.find((c) => c.id === "polaris_ui")!;
    expect(polaris.passed).toBe(false);
    expect(polaris.severity).toBe("warning");
    expect(report.passed).toBe(true); // warnings don't block
  });

  it("flags unjustified protected-data scopes", () => {
    const { project, plan } = compliantProject(["read_customers"]);
    (plan as { scopeJustification: string }).scopeJustification = "read_products only";
    const report = runCompliance(project, plan);
    const check = report.checks.find((c) => c.id === "protected_data_justified")!;
    expect(check.passed).toBe(false);
    expect(check.severity).toBe("warning");
  });
});

describe("complianceSummary", () => {
  it("summarizes pass and fail states", () => {
    const { project, plan } = compliantProject();
    expect(complianceSummary(runCompliance(project, plan))).toContain("all checks passed");
  });
});

describe("buildSubmissionKit", () => {
  it("produces STORE_LISTING.md with listing, scopes, and checklist", () => {
    const { project, plan } = compliantProject(["read_customers"]);
    const report = runCompliance(project, plan);
    const kit = buildSubmissionKit({ ...plan, tagline: "Watch your stock", billing: { model: "recurring", priceUsd: 9, trialDays: 7 } }, report);
    expect(kit.path).toBe("STORE_LISTING.md");
    expect(kit.content).toContain("Stock Watch");
    expect(kit.content).toContain("Watch your stock");
    expect(kit.content).toContain("$9/month");
    expect(kit.content).toContain("read_customers");
    expect(kit.content).toContain("protected customer data");
    expect(kit.content).toContain("Pre-submission checklist");
  });
});

describe("scaffold privacy webhooks", () => {
  it("includes the mandatory compliance webhook routes and toml block", () => {
    const files = getShopifyScaffoldFiles({ appName: "X", scopes: ["read_products"] });
    const paths = new Set(files.map((f) => f.path));
    expect(paths.has("app/routes/webhooks.customers.data_request.tsx")).toBe(true);
    expect(paths.has("app/routes/webhooks.customers.redact.tsx")).toBe(true);
    expect(paths.has("app/routes/webhooks.shop.redact.tsx")).toBe(true);
    const toml = files.find((f) => f.path === "shopify.app.toml")!.content;
    expect(toml).toContain("[webhooks.privacy_compliance]");
    expect(toml).toContain("customer_deletion_url");
  });
});
