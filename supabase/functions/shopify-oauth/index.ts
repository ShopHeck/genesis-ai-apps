// Shopify OAuth for connecting a merchant store to ApexBuild.
//   GET ?action=begin&shop=<store>.myshopify.com  (with user Authorization)
//        → validates shop, stores a CSRF nonce, redirects to Shopify consent.
//   GET ?action=callback&code&hmac&shop&state    (Shopify redirects the browser)
//        → verifies HMAC + state, exchanges code for an offline token, stores it.
//
// Secrets required (Supabase function secrets): SHOPIFY_API_KEY,
// SHOPIFY_API_SECRET, APP_URL (where to send the merchant back afterward).

import { adminClient, resolveUserId } from "../_shared/quota.ts";
import { COMMON_SCOPES } from "../_shared/shopify.ts";
import {
  validateShopDomain, verifyHmac, buildInstallUrl, generateNonce, searchParamsToObject,
} from "../_shared/shopify-oauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "begin";
  const apiKey = Deno.env.get("SHOPIFY_API_KEY");
  const apiSecret = Deno.env.get("SHOPIFY_API_SECRET");
  const appUrl = Deno.env.get("APP_URL") ?? url.origin;
  if (!apiKey || !apiSecret) {
    return json({ error: "Shopify app credentials not configured (SHOPIFY_API_KEY/SHOPIFY_API_SECRET)." }, 500);
  }

  const supabase = adminClient();
  const callbackUri = `${url.origin}${url.pathname}?action=callback`;

  // ── Begin: start the consent flow ──────────────────────────────────────
  if (action === "begin") {
    const shop = url.searchParams.get("shop") ?? "";
    if (!validateShopDomain(shop)) return json({ error: "Invalid shop domain." }, 400);

    const userId = await resolveUserId(req);
    if (!userId) return json({ error: "Sign in before connecting a store." }, 401);

    const state = generateNonce();
    const { error } = await supabase.from("shopify_oauth_states").insert({ state, user_id: userId, shop_domain: shop });
    if (error) return json({ error: "Could not start OAuth." }, 500);

    const installUrl = buildInstallUrl({ shop, apiKey, scopes: [...COMMON_SCOPES], redirectUri: callbackUri, state });
    // The frontend opens this URL; return it as JSON so it controls navigation.
    return json({ installUrl });
  }

  // ── Callback: verify and exchange ──────────────────────────────────────
  if (action === "callback") {
    const params = searchParamsToObject(url);
    const { shop, code, state } = params;

    if (!validateShopDomain(shop)) return json({ error: "Invalid shop domain." }, 400);
    if (!(await verifyHmac(params, apiSecret))) return json({ error: "HMAC verification failed." }, 401);

    // Validate the CSRF nonce and recover which user initiated this.
    const { data: stateRow } = await supabase
      .from("shopify_oauth_states").select("user_id, shop_domain").eq("state", state).maybeSingle();
    if (!stateRow || stateRow.shop_domain !== shop) return json({ error: "Invalid or expired OAuth state." }, 401);

    // Exchange the authorization code for an offline access token.
    const tokenResp = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
    });
    if (!tokenResp.ok) return json({ error: "Token exchange failed." }, 502);
    const token = await tokenResp.json() as { access_token?: string; scope?: string };
    if (!token.access_token) return json({ error: "No access token returned." }, 502);

    await supabase.from("shopify_connections").upsert({
      user_id: stateRow.user_id,
      shop_domain: shop,
      access_token: token.access_token,
      scope: token.scope ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,shop_domain" });

    await supabase.from("shopify_oauth_states").delete().eq("state", state);

    // Send the merchant back into the generator with a success flag.
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: `${appUrl}/generator?connected=${encodeURIComponent(shop)}` } });
  }

  return json({ error: `Unknown action "${action}".` }, 400);
});
