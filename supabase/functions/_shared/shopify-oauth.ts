// Shopify OAuth helpers for connecting a merchant's store to ApexBuild (so
// generation can be grounded in the merchant's real catalog/scopes).
//
// The pure functions here — shop-domain validation, HMAC verification, install
// URL building, timing-safe compare — are unit-tested. The network exchange
// lives in the edge function. Uses the Web Crypto API (works in Deno + Node).

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function validateShopDomain(shop: unknown): shop is string {
  return typeof shop === "string" && SHOP_DOMAIN_RE.test(shop);
}

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time string comparison to avoid leaking via early-exit timing.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Build the canonical message Shopify signs for an OAuth callback: every query
// param except `hmac` and `signature`, sorted by key, joined as key=value with &.
export function canonicalMessage(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "hmac" && k !== "signature")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Verify the HMAC on an OAuth callback's query params.
export async function verifyHmac(params: Record<string, string>, secret: string): Promise<boolean> {
  const provided = params.hmac;
  if (!provided) return false;
  const expected = await hmacSha256Hex(canonicalMessage(params), secret);
  return timingSafeEqual(provided.toLowerCase(), expected.toLowerCase());
}

export function buildInstallUrl(opts: {
  shop: string;
  apiKey: string;
  scopes: string[];
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: opts.apiKey,
    scope: opts.scopes.join(","),
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });
  return `https://${opts.shop}/admin/oauth/authorize?${q.toString()}`;
}

export function searchParamsToObject(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) out[k] = v;
  return out;
}
