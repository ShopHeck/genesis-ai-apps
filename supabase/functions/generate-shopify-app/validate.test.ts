import { describe, it, expect } from "vitest";
import { validateProject } from "./validate";
import { getShopifyScaffoldFiles } from "./scaffold";

// A realistic project: scaffold plumbing (reserved) + 2 engineer-generated screens.
function goodProject(screens = 2, extra?: { path: string; content: string }[]) {
  const plan = { appName: "Test", scopes: ["read_products"], screens: [
    { route: "app/routes/app._index.tsx", name: "Home" },
    { route: "app/routes/app.settings.tsx", name: "Settings" },
  ] };
  const files = [
    ...getShopifyScaffoldFiles(plan as never),
    {
      path: "prisma/schema.prisma",
      content: "datasource db {}\nmodel Session { id String @id\n shop String }",
    },
    {
      path: "app/routes/app._index.tsx",
      content: `import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => { await authenticate.admin(request); return null; };
export default function Index() { return <p>hi</p>; }`,
    },
    {
      path: "app/routes/app.settings.tsx",
      content: `import { authenticate } from "../shopify.server";
export const loader = async ({ request }) => { await authenticate.admin(request); return null; };
export default function Settings() { return <p>hi</p>; }`,
    },
    ...(extra ?? []),
  ];
  return { project: { appName: "Test", summary: "", files }, plan };
}

describe("validateProject", () => {
  it("passes a complete, clean project", () => {
    const { project, plan } = goodProject();
    const r = validateProject(project, plan);
    expect(r.errors).toEqual([]);
  });

  it("errors when a required file is missing", () => {
    const { project, plan } = goodProject();
    project.files = project.files.filter((f) => f.path !== "app/routes/app._index.tsx");
    expect(validateProject(project, plan).errors.some((e) => e.includes("Missing required file"))).toBe(true);
  });

  it("errors on a forbidden (non-installed) import", () => {
    const { project, plan } = goodProject(2, [
      { path: "app/routes/app.report.tsx", content: `import { json } from "@remix-run/node"; export default function R(){return null;}` },
    ]);
    const r = validateProject(project, plan);
    expect(r.errors.some((e) => e.includes("non-installed package"))).toBe(true);
  });

  it("errors when the plan declares more screens than were generated (half-built)", () => {
    const { project, plan } = goodProject(2);
    // Plan claims 3 screens; only 2 route files exist.
    plan.screens.push({ route: "app/routes/app.missing.tsx", name: "Missing" });
    const r = validateProject(project, plan);
    expect(r.errors.some((e) => e.includes("incomplete"))).toBe(true);
  });

  it("does NOT flag console.log in pre-injected scaffold (reserved) files", () => {
    const { project, plan } = goodProject();
    const w = validateProject(project, plan).warnings;
    expect(w.some((x) => x.includes("webhooks") && x.includes("console"))).toBe(false);
  });

  it("warns on console.log / any in ENGINEER files", () => {
    const { project, plan } = goodProject(2, [
      { path: "app/routes/app.report.tsx", content: `export default function R(){ console.log("x"); const a: any = 1; return null; }` },
    ]);
    const w = validateProject(project, plan).warnings;
    expect(w.some((x) => x.includes("console.log"))).toBe(true);
    expect(w.some((x) => x.includes("`any`"))).toBe(true);
  });

  it("warns on a screen route with no default component", () => {
    const { project, plan } = goodProject(2, [
      { path: "app/routes/app.nocomponent.tsx", content: `export const loader = async () => null;` },
    ]);
    const w = validateProject(project, plan).warnings;
    expect(w.some((x) => x.includes("no default-exported component"))).toBe(true);
  });
});
