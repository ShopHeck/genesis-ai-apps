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
import { ANON_MONTHLY_LIMIT, decideQuota, type QuotaDecision } from "./plan-limits.ts";

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
  } catch { /* metering write is non-fatal */ }
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
  } catch { /* metering write is non-fatal — never block the user */ }
}

// ─── In-memory burst limiter (per instance, sliding window) ──────────────
const BURST_WINDOW_MS = 60_000;
const BURST_MAX = 5;
const burstHits = new Map<string, number[]>();

export function isBurstLimited(ip: string): boolean {
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
