import { describe, it, expect } from "vitest";
import {
  getShopifyScaffoldFiles, scaffoldPaths, POLARIS_PATTERNS, getSelectedPolarisPatterns,
  getAdminExtensionFiles, normalizeAdminBlock,
} from "./scaffold";
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

describe("admin UI extension archetype", () => {
  const blockPlan = {
    appName: "Stock Watch",
    includeAdminBlock: true,
    adminBlock: { name: "Low stock", handle: "Low Stock!", target: "admin.product-details.block.render", purpose: "show stock" },
  };

  it("emits nothing unless opted in", () => {
    expect(getAdminExtensionFiles({ appName: "X" })).toEqual([]);
    expect(normalizeAdminBlock({ appName: "X", adminBlock: {} })).toBeNull();
  });

  it("emits a valid block extension when opted in", () => {
    const files = getAdminExtensionFiles(blockPlan);
    const byPath = new Map(files.map((f) => [f.path, f.content]));
    expect(byPath.has("extensions/low-stock/shopify.extension.toml")).toBe(true);
    expect(byPath.has("extensions/low-stock/src/BlockExtension.tsx")).toBe(true);
    expect(byPath.has("extensions/low-stock/locales/en.default.json")).toBe(true);
    expect(byPath.get("extensions/low-stock/shopify.extension.toml")).toContain('target = "admin.product-details.block.render"');
    const tsx = byPath.get("extensions/low-stock/src/BlockExtension.tsx")!;
    expect(tsx).toContain("@shopify/ui-extensions-react/admin");
    expect(tsx).toContain("AdminBlock");
    expect(tsx).toContain("reactExtension");
  });

  it("uses AdminAction wrapper for action targets and falls back to a safe target", () => {
    const action = getAdminExtensionFiles({ ...blockPlan, adminBlock: { ...blockPlan.adminBlock, target: "admin.product-details.action.render" } });
    expect(action.find((f) => f.path.endsWith("BlockExtension.tsx"))!.content).toContain("AdminAction");
    const bad = normalizeAdminBlock({ ...blockPlan, adminBlock: { ...blockPlan.adminBlock, target: "bogus" } })!;
    expect(bad.target).toBe("admin.product-details.block.render");
  });

  it("includes extension paths in the reserved scaffold set", () => {
    const reserved = scaffoldPaths(blockPlan);
    for (const f of getAdminExtensionFiles(blockPlan)) {
      expect(reserved.has(f.path)).toBe(true);
    }
  });
});
