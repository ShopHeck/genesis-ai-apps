import { describe, it, expect } from "vitest";
import { isForbiddenImportSpec, findForbiddenImports, FORBIDDEN_IMPORT_SPECS } from "./shopify";

describe("isForbiddenImportSpec", () => {
  it("rejects legacy Remix imports (the compile-breaker)", () => {
    expect(isForbiddenImportSpec("@remix-run")).toBe(true);
    expect(isForbiddenImportSpec("@remix-run/node")).toBe(true);
    expect(isForbiddenImportSpec("@remix-run/react")).toBe(true);
  });

  it("rejects legacy shopify-app-remix imports", () => {
    expect(isForbiddenImportSpec("@shopify/shopify-app-remix/server")).toBe(true);
    expect(isForbiddenImportSpec("@shopify/shopify-app-remix")).toBe(true);
  });

  it("rejects the bare/deprecated app-bridge (but not app-bridge-react)", () => {
    expect(isForbiddenImportSpec("@shopify/app-bridge")).toBe(true);
    expect(isForbiddenImportSpec("@shopify/app-bridge/utilities")).toBe(true);
    expect(isForbiddenImportSpec("@shopify/app-bridge-react")).toBe(false);
  });

  it("allows the whitelisted react-router / polaris / shopify packages", () => {
    expect(isForbiddenImportSpec("react")).toBe(false);
    expect(isForbiddenImportSpec("react-router")).toBe(false);
    expect(isForbiddenImportSpec("react-router-dom")).toBe(false);
    expect(isForbiddenImportSpec("@react-router/node")).toBe(false);
    expect(isForbiddenImportSpec("@shopify/polaris")).toBe(false);
    expect(isForbiddenImportSpec("@shopify/shopify-app-react-router")).toBe(false);
    expect(isForbiddenImportSpec("@prisma/client")).toBe(false);
  });

  it("allows relative imports", () => {
    expect(isForbiddenImportSpec("../shopify.server")).toBe(false);
    expect(isForbiddenImportSpec("./lib/queries")).toBe(false);
  });
});

describe("findForbiddenImports", () => {
  it("detects a remix leak in source", () => {
    const src = `import { json } from "@remix-run/node";\nimport { useLoaderData } from "@remix-run/react";\nexport const loader = () => json({ ok: true });`;
    expect(findForbiddenImports(src)).toContain("@remix-run/node");
    expect(findForbiddenImports(src)).toContain("@remix-run/react");
  });

  it("detects a shopify-app-remix/server leak", () => {
    const src = `import { authenticate } from "@shopify/shopify-app-remix/server";`;
    expect(findForbiddenImports(src)).toEqual(["@shopify/shopify-app-remix/server"]);
  });

  it("ignores allowed imports and relative paths", () => {
    const src = `import { authenticate } from "../shopify.server";
import { Page } from "@shopify/polaris";
import { json, type LoaderFunctionArgs } from "react-router";`;
    expect(findForbiddenImports(src)).toEqual([]);
  });

  it("dedupes repeated offenders and preserves encounter order", () => {
    const src = `import "a"; import "@remix-run/x"; import "@remix-run/x";`;
    expect(findForbiddenImports(src)).toEqual(["@remix-run/x"]);
  });

  it("every entry in the forbidden list is itself matched", () => {
    for (const spec of FORBIDDEN_IMPORT_SPECS) {
      expect(isForbiddenImportSpec(spec)).toBe(true);
    }
  });
});
