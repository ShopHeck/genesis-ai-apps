// Per-request cost ceiling for the generation pipelines. A single request can
// fan out to many model calls (architect → engineer → reviewer → refiner, plus
// fallbacks and re-reviews); the guard caps estimated spend so a pathological
// request can't run up an unbounded bill. Pure + unit-tested.

export type Role = "architect" | "engineer" | "reviewer";

// Rough USD estimate per call by provider + role (engineer calls are the big
// ones). Deliberately conservative — this is a safety ceiling, not accounting.
const COST_TABLE: Record<string, Record<Role, number>> = {
  gemini: { architect: 0.02, engineer: 0.15, reviewer: 0.02 },
  anthropic: { architect: 0.05, engineer: 0.45, reviewer: 0.03 },
  opencode: { architect: 0.04, engineer: 0.35, reviewer: 0.03 },
};

export function estimateCost(provider: string, role: Role): number {
  return COST_TABLE[provider]?.[role] ?? COST_TABLE.gemini[role];
}

// Default ceiling (USD) per generation request; override with MAX_GENERATION_COST_USD.
export function defaultMaxCost(): number {
  const raw = Number(Deno.env.get("MAX_GENERATION_COST_USD"));
  return Number.isFinite(raw) && raw > 0 ? raw : 2.0;
}

export class CostLimitError extends Error {
  constructor(public spent: number, public max: number) {
    super(`Generation cost ceiling reached ($${spent.toFixed(2)} of $${max.toFixed(2)}).`);
    this.name = "CostLimitError";
  }
}

export class CostGuard {
  private spent = 0;
  constructor(private readonly maxUsd: number) {}

  // Charge for a call BEFORE making it; throws if it would exceed the ceiling.
  charge(provider: string, role: Role): void {
    const next = this.spent + estimateCost(provider, role);
    if (next > this.maxUsd) throw new CostLimitError(next, this.maxUsd);
    this.spent = next;
  }

  // Would this call fit under the ceiling? (non-throwing check)
  canAfford(provider: string, role: Role): boolean {
    return this.spent + estimateCost(provider, role) <= this.maxUsd;
  }

  get total(): number {
    return Math.round(this.spent * 100) / 100;
  }
}
