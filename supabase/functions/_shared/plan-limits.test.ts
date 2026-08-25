import { describe, it, expect } from "vitest";
import {
  PLAN_LIMITS,
  PLAN_MONTHLY_SPEND_USD,
  ANON_MONTHLY_LIMIT,
  normalizePlan,
  planLimit,
  planSpendLimit,
  decideQuota,
  providerAllowed,
} from "./plan-limits";

describe("normalizePlan", () => {
  it("passes through known paid plans", () => {
    expect(normalizePlan("pro")).toBe("pro");
    expect(normalizePlan("studio")).toBe("studio");
  });

  it("defaults unknown / nullish values to free", () => {
    expect(normalizePlan("free")).toBe("free");
    expect(normalizePlan(null)).toBe("free");
    expect(normalizePlan(undefined)).toBe("free");
    expect(normalizePlan("enterprise")).toBe("free");
  });
});

describe("planLimit", () => {
  it("returns the configured limit per plan", () => {
    expect(planLimit("free")).toBe(PLAN_LIMITS.free);
    expect(planLimit("pro")).toBe(PLAN_LIMITS.pro);
    expect(planLimit("studio")).toBe(Infinity);
  });
});

describe("decideQuota", () => {
  it("allows when under the limit and reports remaining", () => {
    const d = decideQuota("free", 1);
    expect(d).toMatchObject({ allowed: true, plan: "free", used: 1, limit: 3, remaining: 2 });
  });

  it("blocks when at the limit", () => {
    expect(decideQuota("free", 3).allowed).toBe(false);
    expect(decideQuota("pro", PLAN_LIMITS.pro).allowed).toBe(false);
  });

  it("never blocks studio (unlimited)", () => {
    const d = decideQuota("studio", 10_000);
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(Infinity);
  });

  it("treats negative / NaN usage as zero", () => {
    expect(decideQuota("free", -5).used).toBe(0);
    expect(decideQuota("free", Number.NaN).used).toBe(0);
  });

  it("floors fractional usage", () => {
    expect(decideQuota("free", 2.9).used).toBe(2);
  });
});

describe("providerAllowed", () => {
  it("allows the default provider on any plan", () => {
    expect(providerAllowed("gemini", "free")).toBe(true);
    expect(providerAllowed("gemini", null)).toBe(true);
  });

  it("gates premium providers behind studio", () => {
    expect(providerAllowed("anthropic", "free")).toBe(false);
    expect(providerAllowed("anthropic", "pro")).toBe(false);
    expect(providerAllowed("anthropic", "studio")).toBe(true);
    expect(providerAllowed("opencode", "studio")).toBe(true);
  });
});

describe("planSpendLimit", () => {
  it("returns a finite monthly AI spend ceiling per plan", () => {
    expect(planSpendLimit("free")).toBe(PLAN_MONTHLY_SPEND_USD.free);
    expect(planSpendLimit("pro")).toBe(PLAN_MONTHLY_SPEND_USD.pro);
    expect(planSpendLimit("studio")).toBe(PLAN_MONTHLY_SPEND_USD.studio);
  });

  it("falls back to the free cap for unknown plans", () => {
    expect(planSpendLimit(null)).toBe(PLAN_MONTHLY_SPEND_USD.free);
    expect(planSpendLimit("enterprise")).toBe(PLAN_MONTHLY_SPEND_USD.free);
  });

  it("caps a studio subscriber well below unlimited", () => {
    // Studio = unlimited BUILDS, but a bounded AI BILL.
    expect(Number.isFinite(planSpendLimit("studio"))).toBe(true);
  });
});

describe("constants", () => {
  it("keeps the anonymous trial at a single build", () => {
    expect(ANON_MONTHLY_LIMIT).toBe(1);
  });
});
