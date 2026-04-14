import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const perks = ["Unlimited prompts", "Live preview", "Export source code", "Community support"];

const PricingTeaser = () => {
  return (
    <section id="pricing" className="section-padding bg-muted/10">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Start free. <span className="gradient-text">Scale when ready.</span>
          </h2>
          <p className="text-muted-foreground mb-10">
            Build your first app at no cost. Upgrade for advanced features when you need them.
          </p>

          <div className="glass-panel p-8 md:p-10 border-primary/20 shadow-[var(--shadow-glow-sm)] inline-block w-full max-w-md text-left">
            <div className="mb-6">
              <span className="text-sm font-medium text-primary">Free Plan</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">$0</span>
                <span className="text-muted-foreground text-sm">/ month</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2.5 text-sm">
                  <Check size={16} className="text-primary flex-shrink-0" />
                  {perk}
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)] group"
            >
              Get Started
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingTeaser;
