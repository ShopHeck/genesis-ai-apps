// Unified metering + anti-abuse for every generation edge function.
// Single source of truth so the web, iOS, and Shopify generators enforce the
// same quotas and persist usage the same way.
//
//   - Authenticated users  → monthly limit by plan (generations table + RPCs)
//   - Anonymous users      → durable per-IP monthly trial (anonymous_generations)
//   - Everyone             → cheap in-memory burst limiter (per instance)
//
// IPs are never stored in the clear — they are HMAC-hashed with ANON_IP_SALT.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { ANON_MONTHLY_LIMIT, decideQuota, planSpendLimit, type QuotaDecision } from "./plan-limits.ts";

export type SupabaseClient = ReturnType<typeof createClient>;

export { decideQuota, type QuotaDecision };

// ─── Client / auth helpers ───────────────────────────────────────────────
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Resolve the calling user (if any) from the Authorization header.
export async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

// ─── Authenticated quota (plan-based, via SQL RPCs) ──────────────────────
export async function checkUserQuota(supabase: SupabaseClient, userId: string): Promise<QuotaDecision> {
  const [{ data: planData }, { data: usedData }] = await Promise.all([
    supabase.rpc("get_user_plan", { p_user_id: userId }),
    supabase.rpc("count_monthly_generations", { p_user_id: userId }),
  ]);
  return decideQuota(planData as string | null, (usedData as number) ?? 0);
}

// ─── Monthly AI spend cap (cost guard, not quota) ─────────────────────────
// Prevents a single subscriber (e.g. Studio = "unlimited" generations) from
// running up an unbounded model bill in a month. Sums the REAL recorded cost
// (cost_usd) for the current calendar month and blocks a request whose estimated
// cost would push the user past their plan's ceiling.
export async function checkMonthlySpend(
  supabase: SupabaseClient,
  userId: string,
  plan: string | null | undefined,
  estimatedCostUsd: number,
): Promise<{ allowed: boolean; spent: number; limit: number }> {
  const limit = planSpendLimit(plan);
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("generations")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  const rows = (data ?? []) as Array<{ cost_usd?: unknown }>;
  const spent = rows.reduce((sum: number, row) => sum + (Number(row?.cost_usd) || 0), 0);
  const next = spent + Math.max(0, estimatedCostUsd);
  return { allowed: next <= limit, spent, limit };
}

// ─── Anonymous quota (durable, per-IP per-month) ─────────────────────────
export async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get("ANON_IP_SALT") ?? "apexbuild-default-salt";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkAnonQuota(supabase: SupabaseClient, ipHash: string): Promise<QuotaDecision> {
  const { data } = await supabase.rpc("count_monthly_anon_generations", { p_ip_hash: ipHash });
  const used = (data as number) ?? 0;
  const allowed = used < ANON_MONTHLY_LIMIT;
  return { allowed, plan: "free", used, limit: ANON_MONTHLY_LIMIT, remaining: Math.max(0, ANON_MONTHLY_LIMIT - used) };
}

export async function recordAnonGeneration(supabase: SupabaseClient, ipHash: string): Promise<void> {
  try {
    await supabase.from("anonymous_generations").insert({ ip_hash: ipHash });
  } catch (e) {
    // Metering write is non-fatal, but a silent failure hides an uncounted trial.
    console.error("[quota] recordAnonGeneration insert failed:", e instanceof Error ? e.message : e);
  }
}

// ─── Generation persistence (authenticated history + cost metering) ──────
export interface GenerationRecord {
  user_id: string;
  prompt: string;
  app_name?: string;
  bundle_id?: string;
  summary?: string;
  files?: unknown;
  files_count?: number;
  status: "success" | "failed";
  model_used?: string;
  cost_usd?: number;
  target?: string;
}

export async function recordGeneration(supabase: SupabaseClient, row: GenerationRecord): Promise<void> {
  try {
    await supabase.from("generations").insert(row);
  } catch (e) {
    // Metering write is non-fatal (never block the user), but if it fails the
    // generation is NEITHER counted against quota NOR saved to history AND the
    // monthly spend sum misses it. Log loudly so it's observable.
    console.error("[quota] recordGeneration insert failed:", e instanceof Error ? e.message : e);
  }
}

// ─── In-memory burst limiter (per instance, sliding window) ──────────────
const BURST_WINDOW_MS = 60_000;
const BURST_MAX = 5;
const BURST_MAP_HIGHWATER = 5_000; // bound per-instance memory; prune when exceeded
const burstHits = new Map<string, number[]>();

// Prune stale keys so a busy instance doesn't grow the map unboundedly.
function maybeEvictBursts(): void {
  if (burstHits.size <= BURST_MAP_HIGHWATER) return;
  const cutoff = Date.now() - BURST_WINDOW_MS;
  for (const [ip, hits] of burstHits) {
    if (hits.length === 0 || hits[hits.length - 1] < cutoff) burstHits.delete(ip);
  }
}

export function isBurstLimited(ip: string): boolean {
  maybeEvictBursts();
  const now = Date.now();
  const hits = (burstHits.get(ip) ?? []).filter((t) => now - t < BURST_WINDOW_MS);
  if (hits.length >= BURST_MAX) {
    burstHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  burstHits.set(ip, hits);
  return false;
}
