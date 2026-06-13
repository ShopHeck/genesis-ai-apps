import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Store, Puzzle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXAMPLE_PROMPTS } from "@/data/prompt-templates";
import type { ShopifyArchetype } from "@/components/generator/types";

const ARCHETYPE_LABEL: Record<ShopifyArchetype, { label: string; icon: typeof Store }> = {
  embedded_admin: { label: "Embedded admin", icon: Store },
  admin_extension: { label: "Admin extension", icon: Puzzle },
};

export default function Templates() {
  const navigate = useNavigate();
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(EXAMPLE_PROMPTS.map((t) => t.category)))],
    [],
  );
  const [active, setActive] = useState("All");

  const shown = active === "All"
    ? EXAMPLE_PROMPTS
    : EXAMPLE_PROMPTS.filter((t) => t.category === active);

  const generate = (prompt: string) => {
    navigate(`/generator?target=shopify&prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Templates — ApexBuild</title>
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="font-display text-lg font-bold">
            <span className="gradient-text">Apex</span>Build{" "}
            <span className="text-muted-foreground font-normal">/ Templates</span>
          </div>
          <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)]">
            <Link to="/generator"><Sparkles size={14} className="mr-1.5" /> New App</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <p className="text-sm font-medium text-primary mb-3">Template gallery</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            Start from a <span className="gradient-text">proven blueprint</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {EXAMPLE_PROMPTS.length} curated Shopify app blueprints — each maps to the Admin API and Polaris and generates an installable app. Pick one and tweak the prompt.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                active === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map((t) => {
            const arch = ARCHETYPE_LABEL[t.archetype ?? "embedded_admin"];
            const ArchIcon = arch.icon;
            return (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative rounded-xl border border-border/60 bg-card/40 p-5 flex flex-col overflow-hidden hover:border-primary/40 transition-all"
                style={{ backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${t.accent}1f, transparent 60%)` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl ring-1 ring-inset ring-white/10"
                    style={{ background: `linear-gradient(135deg, ${t.accent}55, ${t.accent}1a)` }}
                    aria-hidden
                  >
                    {t.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: t.accent }}>{t.category}</p>
                    <h3 className="text-sm font-semibold leading-tight">{t.label}</h3>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-snug mb-3 flex-1">{t.tagline}</p>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-3">
                  <ArchIcon size={11} />
                  {arch.label}
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {t.screens.map((s) => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/50 text-muted-foreground">{s}</span>
                  ))}
                </div>

                <Button
                  size="sm"
                  className="w-full bg-primary/90 text-primary-foreground hover:bg-primary"
                  onClick={() => generate(t.prompt)}
                >
                  <Wand2 size={13} className="mr-1.5" /> Generate this
                </Button>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
