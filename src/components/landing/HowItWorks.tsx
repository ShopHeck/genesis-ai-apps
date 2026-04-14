import { motion } from "framer-motion";
import { MessageSquare, Cpu, Rocket } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    title: "Describe Your Idea",
    description: "Type a plain-English prompt describing the app you want to build. Be as detailed or as brief as you like.",
    step: "01",
  },
  {
    icon: Cpu,
    title: "AI Generates Your App",
    description: "Our engine builds screens, navigation, data models, and native-feel UI — all in seconds.",
    step: "02",
  },
  {
    icon: Rocket,
    title: "Refine & Launch",
    description: "Iterate with follow-up prompts, preview live, and publish your app when it's ready.",
    step: "03",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="section-padding">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            Idea to app in <span className="gradient-text">three steps</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            No design skills. No coding. Just describe what you want and watch it come to life.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="glass-panel-hover p-8 text-center relative group"
            >
              <span className="absolute top-4 right-4 font-display text-5xl font-bold text-muted/40 select-none">
                {step.step}
              </span>
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5 group-hover:shadow-[var(--shadow-glow-sm)] transition-shadow">
                <step.icon size={24} className="text-primary" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
