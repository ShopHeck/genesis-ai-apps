import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    label: "Free",
    price: "$0",
    icon: <Zap size={16} className="text-muted-foreground" />,
    perks: ["3 builds / month", "Live preview", "Download ZIP", "Community support"],
    cta: "Get started",
    ctaLink: "/generator",
    highlight: false,
  },
  {
    label: "Pro",
    price: "$29",
    icon: <Sparkles size={16} className="text-primary" />,
    perks: ["30 builds / month", "Monaco code editor", "Regenerate files with AI", "Project history", "Email support"],
    cta: "Upgrade to Pro",
    ctaLink: "/pricing",
    highlight: true,
  },
];

const PricingTeaser = () => {
  return (
    <section id="pricing" className="section-padding bg-muted/10">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Start free. <span className="gradient-text">Scale when ready.</span>
          </h2>
          <p className="text-muted-foreground">
            Build your first app at no cost. Upgrade for the code editor, more builds, and project history.
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`flex-1 glass-panel p-7 text-left flex flex-col ${
                tier.highlight ? "border-primary/40 shadow-[var(--shadow-glow-sm)]" : "border-border/40"
              }`}
            >
              {tier.highlight && (
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full self-start mb-3">
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                {tier.icon}
                <span className="text-sm font-medium text-muted-foreground">{tier.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="font-display text-3xl font-bold">{tier.price}</span>
                <span className="text-muted-foreground text-sm">/ month</span>
              </div>
              <ul className="space-y-2.5 mb-7 flex-1">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm">
                    <Check size={14} className="text-primary flex-shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                variant={tier.highlight ? "default" : "outline"}
                className={`w-full group ${
                  tier.highlight
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)]"
                    : "border-border/60"
                }`}
              >
                <Link to={tier.ctaLink}>
                  {tier.cta}
                  <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          Need unlimited builds and Claude Opus?{" "}
          <Link to="/pricing" className="text-primary hover:underline">
            See Studio plan →
          </Link>
        </motion.p>
      </div>
    </section>
  );
};

export default PricingTeaser;
