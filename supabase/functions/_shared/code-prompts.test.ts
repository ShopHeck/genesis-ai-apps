import { describe, it, expect } from "vitest";
import { normalizeTarget, codeAssistantRules, languageForPath, codeTargetLabel } from "./code-prompts.ts";

describe("code-prompts", () => {
  it("normalizes unknown targets to shopify", () => {
    expect(normalizeTarget("shopify")).toBe("shopify");
    expect(normalizeTarget("web")).toBe("web");
    expect(normalizeTarget("ios")).toBe("shopify"); // legacy target falls back safely
    expect(normalizeTarget(undefined)).toBe("shopify");
    expect(normalizeTarget(null)).toBe("shopify");
  });

  it("produces distinct, stack-specific rule sets", () => {
    const shopify = codeAssistantRules("shopify");
    const web = codeAssistantRules("web");
    expect(shopify).toContain("authenticate.admin");
    expect(shopify).toContain("@shopify/polaris");
    expect(shopify).toContain("Prisma");
    expect(web).toContain("Tailwind");
    expect(web).toContain("lucide-react");
    expect(shopify).not.toContain("SwiftUI");
    expect(shopify).not.toContain("Swift 6");
  });

  it("maps file paths to a human-readable language", () => {
    expect(languageForPath("app/routes/app._index.tsx")).toBe("TypeScript/TSX");
    expect(languageForPath("prisma/schema.prisma")).toBe("Prisma schema");
    expect(languageForPath("shopify.app.toml")).toBe("TOML (shopify.app.toml / app config)");
    expect(languageForPath("src/index.ts")).toBe("TypeScript");
    expect(languageForPath("styles.css")).toBe("CSS");
  });

  it("labels targets clearly", () => {
    expect(codeTargetLabel("shopify")).toBe("Shopify embedded-admin (React Router + Polaris + Prisma + Admin GraphQL)");
  });
});
