import { motion } from "framer-motion";
import { ShoppingBag, Dumbbell, BarChart3, Store, Wallet } from "lucide-react";

const apps = [
  { icon: ShoppingBag, name: "StyleDrop", category: "E-commerce", color: "text-pink-400" },
  { icon: Dumbbell, name: "FitPulse", category: "Fitness", color: "text-green-400" },
  { icon: BarChart3, name: "TaskFlow", category: "Productivity", color: "text-primary" },
  { icon: Store, name: "MarketLink", category: "Marketplace", color: "text-orange-400" },
  { icon: Wallet, name: "CoinTrack", category: "Finance", color: "text-glow-violet" },
];

const ShowcaseSection = () => {
  return (
    <section id="showcase" className="section-padding bg-muted/10">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold">
            Apps people are <span className="gradient-text">building</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-md mx-auto">
            From storefronts to fitness trackers — see what's possible in minutes.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {apps.map((app, i) => (
            <motion.div
              key={app.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel-hover p-6 text-center cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                <app.icon size={26} className={app.color} />
              </div>
              <h3 className="font-display font-semibold text-base">{app.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{app.category}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShowcaseSection;
