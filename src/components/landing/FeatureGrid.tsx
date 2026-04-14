import { motion } from "framer-motion";
import { Wand2, Eye, RefreshCw, Smartphone, Plug, Download } from "lucide-react";

const features = [
  {
    icon: Wand2,
    title: "Prompt-to-App",
    description: "Describe your app in natural language and get a fully structured mobile app back.",
  },
  {
    icon: Eye,
    title: "Live Previews",
    description: "See your app render in real time as the AI builds each screen and component.",
  },
  {
    icon: RefreshCw,
    title: "Fast Iterations",
    description: "Refine with follow-up prompts. Each change takes seconds, not sprints.",
  },
  {
    icon: Smartphone,
    title: "Native-Feel UI",
    description: "Generated apps use polished, platform-native components that feel right on iOS and Android.",
  },
  {
    icon: Plug,
    title: "Backend Ready",
    description: "Authentication, databases, and API integrations — all generated alongside your UI.",
  },
  {
    icon: Download,
    title: "Export & Own",
    description: "Download the full source code. No lock-in, no vendor dependency. It's yours.",
  },
];

const FeatureGrid = () => {
  return (
    <section id="features" className="section-padding bg-muted/10">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            Everything you need to <span className="gradient-text">ship fast</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            From prompt to production. Every feature designed for speed and polish.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel-hover p-7 group"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:shadow-[var(--shadow-glow-sm)] transition-shadow">
                <feature.icon size={20} className="text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureGrid;
