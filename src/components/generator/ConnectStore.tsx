import { useEffect, useState } from "react";
import { Store, Loader2, CheckCircle2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Lets a signed-in user connect their Shopify store so generation is grounded
// in their real catalog. The access token never reaches the client — only the
// non-secret connection status (shop domain) is read here.
export function ConnectStore({ userId }: { userId: string | null }) {
  const [shop, setShop] = useState("");
  const [connectedShop, setConnectedShop] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) { setChecking(false); return; }
      const { data } = await supabase
        .from("shopify_connection_status")
        .select("shop_domain")
        .eq("user_id", userId)
        .order("installed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) {
        setConnectedShop(data?.shop_domain ?? null);
        setChecking(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  const normalizedShop = (value: string): string | null => {
    const v = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (/^[a-z0-9][a-z0-9-]*$/.test(v)) return `${v}.myshopify.com`;
    if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(v)) return v;
    return null;
  };

  const connect = async () => {
    const domain = normalizedShop(shop);
    if (!domain) {
      toast.error("Enter your store name (e.g. acme or acme.myshopify.com).");
      return;
    }
    setLoading(true);
    try {
      // Call the function URL directly so we can pass query params (action, shop).
      const { data: { session } } = await supabase.auth.getSession();
      const base = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${base}/functions/v1/shopify-oauth?action=begin&shop=${encodeURIComponent(domain)}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      });
      const json = await resp.json();
      if (!resp.ok || !json.installUrl) throw new Error(json.error ?? "Could not start connection.");
      window.location.href = json.installUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connection failed");
      setLoading(false);
    }
  };

  if (!userId) return null;

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={12} className="animate-spin" /> Checking store connection…
      </div>
    );
  }

  if (connectedShop) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <CheckCircle2 size={14} className="text-emerald-400" />
        <span className="text-foreground">Grounded in <span className="font-medium">{connectedShop}</span></span>
        <span className="text-muted-foreground/60">— generation uses your real catalog</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Store size={14} className="text-muted-foreground" />
      <input
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        placeholder="your-store"
        className="h-7 w-40 rounded-md bg-background/60 border border-border/60 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        disabled={loading}
      />
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-border/60 hover:border-primary/40" onClick={connect} disabled={loading}>
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
        <span className="ml-1.5">Connect store</span>
      </Button>
      <span className="text-[10px] text-muted-foreground/60">optional — grounds generation in your real products</span>
    </div>
  );
}
