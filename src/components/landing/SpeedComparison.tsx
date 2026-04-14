import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

const oldWay = [
  "Hire a dev team",
  "Weeks of wireframing",
  "Months of development",
  "Costly revisions",
  "$50K–$200K budget",
];

const newWay = [
  "Describe in one sentence",
  "AI generates in seconds",
  "Iterate with prompts",
  "Live preview instantly",
  "Launch same day",
];

const SpeedComparison = () => {
  return (
    <section className="section-padding">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            The old way is <span className="gradient-text">over</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            Stop spending months and thousands. Start shipping in minutes.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-8 border-destructive/20"
          >
            <h3 className="font-display text-lg font-semibold text-muted-foreground mb-6">Traditional Development</h3>
            <ul className="space-y-4">
              {oldWay.map((item) => (
                <li key={item} className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <X size={14} className="text-destructive" />
                  </div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-8 border-primary/30 shadow-[var(--shadow-glow-sm)]"
          >
            <h3 className="font-display text-lg font-semibold mb-6">
              With <span className="gradient-text">ApexBuild</span>
            </h3>
            <ul className="space-y-4">
              {newWay.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-primary" />
                  </div>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SpeedComparison;
