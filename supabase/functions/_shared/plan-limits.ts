// Pure plan/quota policy — no external imports so it is unit-testable in
// both Deno (edge functions) and Node (vitest). All metering decisions flow
// through these functions so the web, iOS, and Shopify generators stay in sync.

export type Plan = "free" | "pro" | "studio";

// Monthly successful-generation allowance per plan.
export const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  pro: 30,
  studio: Infinity,
};

// Signed-out users get a single trial build per rolling month, enforced
// server-side by IP hash (the client-side counter is advisory only).
export const ANON_MONTHLY_LIMIT = 1;

// Premium providers (anything other than the default Gemini path) are a
// Studio-tier capability across every generator.
export const PREMIUM_PROVIDERS = ["anthropic", "opencode"] as const;

export function normalizePlan(plan: string | null | undefined): Plan {
  return plan === "pro" || plan === "studio" ? plan : "free";
}

export function planLimit(plan: string | null | undefined): number {
  return PLAN_LIMITS[normalizePlan(plan)];
}

export interface QuotaDecision {
  allowed: boolean;
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
}

export function decideQuota(plan: string | null | undefined, used: number): QuotaDecision {
  const p = normalizePlan(plan);
  const limit = PLAN_LIMITS[p];
  const safeUsed = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - safeUsed);
  return { allowed: safeUsed < limit, plan: p, used: safeUsed, limit, remaining };
}

// A premium provider requires the Studio plan. Unknown providers are treated
// as the default (allowed) so callers validate the provider name separately.
export function providerAllowed(provider: string, plan: string | null | undefined): boolean {
  if (!(PREMIUM_PROVIDERS as readonly string[]).includes(provider)) return true;
  return normalizePlan(plan) === "studio";
}
