import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Sparkles, Crown, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";

const PLANS = [
  {
    key: "free",
    label: "Free",
    price: "$0",
    period: "/ month",
    icon: <Zap size={18} />,
    description: "Start building instantly. No credit card required.",
    features: [
      "3 app generations / month",
      "Interactive HTML preview",
      "Download Xcode project ZIP",
      "30+ curated app templates",
      "Community support",
      "ApexBuild README watermark",
    ],
    cta: "Get started free",
    ctaVariant: "outline" as const,
    highlight: false,
  },
  {
    key: "pro",
    label: "Pro",
    price: "$29",
    period: "/ month",
    icon: <Sparkles size={18} />,
    description: "For indie developers building real products.",
    features: [
      "30 app generations / month",
      "In-browser Monaco code editor",
      "Regenerate individual files with AI",
      "Project history (last 30 saved)",
      "Priority generation queue",
      "No watermark",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    ctaVariant: "default" as const,
    highlight: true,
    stripePriceId: "pro",
  },
  {
    key: "studio",
    label: "Studio",
    price: "$99",
    period: "/ month",
    icon: <Crown size={18} />,
    description: "For teams shipping multiple apps per month.",
    features: [
      "Unlimited app generations",
      "Claude Opus 4.7 model option",
      "Full project history",
      "3 team seats",
      "REST API access",
      "Priority Slack support",
      "Custom bundle ID prefix",
      "White-label exports",
    ],
    cta: "Upgrade to Studio",
    ctaVariant: "outline" as const,
    highlight: false,
    stripePriceId: "studio",
  },
];

export default function Pricing() {
  const { user, plan } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleUpgrade = async (planKey: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (planKey === "free" || planKey === plan) return;

    setLoadingPlan(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { plan: planKey },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        reason="Sign in to upgrade your plan"
      />

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="font-display text-lg font-bold">
            <span className="gradient-text">Apex</span>Build{" "}
            <span className="text-muted-foreground font-normal">/ Pricing</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <p className="text-sm font-medium text-primary mb-3">Pricing</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Start free. <span className="gradient-text">Ship faster.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Every plan generates production-grade SwiftUI apps. Upgrade when you need more builds, the code editor, or team features.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`glass-panel p-7 flex flex-col relative ${
                p.highlight
                  ? "border-primary/40 shadow-[var(--shadow-glow-md)]"
                  : "border-border/40"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-[var(--shadow-glow-sm)]">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className={`flex items-center gap-2 text-sm font-medium mb-3 ${p.highlight ? "text-primary" : "text-muted-foreground"}`}>
                  {p.icon}
                  {p.label}
                  {plan === p.key && user && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">Current</span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground text-sm">{p.period}</span>
                </div>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {p.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check size={15} className="text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                variant={p.ctaVariant}
                className={`w-full ${
                  p.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)]"
                    : "border-border/60 hover:border-primary/40"
                }`}
                onClick={() => p.key === "free" ? undefined : handleUpgrade(p.key)}
                disabled={loadingPlan !== null || (plan === p.key && !!user)}
                asChild={p.key === "free" && !user}
              >
                {p.key === "free" && !user ? (
                  <Link to="/generator">{p.cta}</Link>
                ) : (
                  <>
                    {loadingPlan === p.key && <Loader2 size={16} className="animate-spin mr-2" />}
                    {plan === p.key && user ? "Current plan" : p.cta}
                  </>
                )}
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-14 glass-panel p-6 text-center"
        >
          <h3 className="font-display text-lg font-semibold mb-2">All plans include</h3>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 mt-4 text-sm text-muted-foreground">
            {[
              "Swift 6 strict concurrency",
              "SwiftData persistence",
              "SwiftUI + NavigationStack",
              "Xcode 16+ / iOS 18+ target",
              "XcodeGen project manifest",
              "You own 100% of the code",
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check size={13} className="text-primary" />
                {item}
              </span>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
