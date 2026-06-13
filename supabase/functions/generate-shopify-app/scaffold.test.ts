import { describe, it, expect } from "vitest";
import { getShopifyScaffoldFiles, scaffoldPaths, POLARIS_PATTERNS, getSelectedPolarisPatterns } from "./scaffold";
import { isProtectedScope, ADMIN_API_VERSION } from "../_shared/shopify";

const plan = {
  appName: "Low Stock Alerts",
  scopes: ["read_products", "read_inventory"],
  navigation: [{ label: "Items", route: "/app/items" }],
};

describe("getShopifyScaffoldFiles", () => {
  const files = getShopifyScaffoldFiles(plan);
  const byPath = new Map(files.map((f) => [f.path, f.content]));

  it("injects the React Router template plumbing", () => {
    for (const req of [
      "app/shopify.server.ts",
      "app/db.server.ts",
      "app/root.tsx",
      "app/entry.server.tsx",
      "app/routes/app.tsx",
      "app/routes/auth.$.tsx",
      "shopify.app.toml",
      "package.json",
    ]) {
      expect(byPath.has(req), `missing ${req}`).toBe(true);
    }
  });

  it("writes the plan's scopes into shopify.app.toml and pins the API version", () => {
    const toml = byPath.get("shopify.app.toml")!;
    expect(toml).toContain("read_products,read_inventory");
    expect(toml).toContain(`api_version = "${ADMIN_API_VERSION}"`);
  });

  it("renders nav links from the plan into the app shell", () => {
    expect(byPath.get("app/routes/app.tsx")).toContain('<Link to="/app/items">Items</Link>');
  });

  it("produces a slugified package name and valid JSON", () => {
    const pkg = JSON.parse(byPath.get("package.json")!);
    expect(pkg.name).toBe("low-stock-alerts");
    expect(pkg.dependencies["@shopify/polaris"]).toBeTruthy();
    expect(pkg.dependencies["@shopify/shopify-app-react-router"]).toBeTruthy();
  });

  it("defaults scopes when none are provided", () => {
    const toml = new Map(getShopifyScaffoldFiles({ appName: "X" }).map((f) => [f.path, f.content])).get("shopify.app.toml")!;
    expect(toml).toContain("read_products,write_products");
  });
});

describe("scaffoldPaths", () => {
  it("matches the emitted scaffold file set (used to protect plumbing from overwrite)", () => {
    const reserved = scaffoldPaths(plan);
    for (const f of getShopifyScaffoldFiles(plan)) {
      expect(reserved.has(f.path)).toBe(true);
    }
  });
});

describe("isProtectedScope", () => {
  it("flags customer/order scopes as protected", () => {
    expect(isProtectedScope("read_customers")).toBe(true);
    expect(isProtectedScope("read_orders")).toBe(true);
    expect(isProtectedScope("read_products")).toBe(false);
  });
});

describe("getSelectedPolarisPatterns", () => {
  it("returns guidance for known ids and empty string for none", () => {
    const ids = POLARIS_PATTERNS.slice(0, 2).map((p) => p.id);
    const guide = getSelectedPolarisPatterns(ids);
    expect(guide).toContain("POLARIS PATTERN RECIPES");
    expect(getSelectedPolarisPatterns([])).toBe("");
  });
});
