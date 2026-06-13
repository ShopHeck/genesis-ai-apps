import { describe, it, expect } from "vitest";
import { CostGuard, CostLimitError, estimateCost } from "./cost";

describe("estimateCost", () => {
  it("returns per-provider/role estimates, engineer being priciest", () => {
    expect(estimateCost("anthropic", "engineer")).toBeGreaterThan(estimateCost("anthropic", "architect"));
    expect(estimateCost("gemini", "reviewer")).toBeGreaterThan(0);
  });
  it("falls back to gemini estimates for unknown providers", () => {
    expect(estimateCost("mystery", "engineer")).toBe(estimateCost("gemini", "engineer"));
  });
});

describe("CostGuard", () => {
  it("allows calls under the ceiling and tracks total", () => {
    const g = new CostGuard(1.0);
    g.charge("gemini", "architect");
    g.charge("gemini", "engineer");
    expect(g.total).toBeGreaterThan(0);
    expect(g.total).toBeLessThanOrEqual(1.0);
  });

  it("throws CostLimitError when a call would exceed the ceiling", () => {
    const g = new CostGuard(0.1); // below one anthropic engineer call (0.45)
    expect(() => g.charge("anthropic", "engineer")).toThrow(CostLimitError);
  });

  it("does not charge when the call is rejected", () => {
    const g = new CostGuard(0.1);
    try { g.charge("anthropic", "engineer"); } catch { /* expected */ }
    expect(g.total).toBe(0);
  });

  it("canAfford predicts without charging", () => {
    const g = new CostGuard(0.05);
    expect(g.canAfford("anthropic", "engineer")).toBe(false);
    expect(g.canAfford("gemini", "architect")).toBe(true);
    expect(g.total).toBe(0);
  });
});
