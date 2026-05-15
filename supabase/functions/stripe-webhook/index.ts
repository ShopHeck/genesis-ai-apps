// Stripe webhook handler
// Events handled:
//   checkout.session.completed → create/update subscription
//   customer.subscription.updated → update plan/status
//   customer.subscription.deleted → mark canceled

import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(",").reduce((acc: Record<string, string>, part) => {
    const [k, v] = part.split("=");
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const sig = parts["v1"];
  if (!timestamp || !sig) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === sig;
}

function planFromMetadata(metadata: Record<string, string>): "pro" | "studio" | "free" {
  return (metadata?.plan as "pro" | "studio") ?? "free";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  const valid = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = JSON.parse(body);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const plan = planFromMetadata(session.metadata ?? {});
        const subscriptionId = session.subscription;

        if (!userId || !subscriptionId) break;

        // Fetch subscription details from Stripe
        const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}` },
        });
        const sub = await subResp.json();

        await supabase.from("subscriptions").upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          plan,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        const plan = planFromMetadata(sub.metadata ?? {});

        if (!userId) break;

        await supabase.from("subscriptions").update({
          plan: sub.status === "canceled" ? "free" : plan,
          status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) break;

        await supabase.from("subscriptions").update({
          plan: "free",
          status: "canceled",
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
