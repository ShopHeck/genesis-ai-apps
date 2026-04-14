import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    quote: "I described my marketplace idea over coffee and had a working prototype by lunch. This is the future of building.",
    name: "Sarah Chen",
    title: "Founder, NomadKit",
    avatar: "SC",
  },
  {
    quote: "We replaced a $40K agency quote with ApexBuild. The MVP was better than what they proposed — and it took two days.",
    name: "Marcus Rivera",
    title: "CEO, StackBridge",
    avatar: "MR",
  },
  {
    quote: "As a non-technical founder, this gave me superpowers. I can iterate on my app faster than my competitors can schedule meetings.",
    name: "Priya Kapoor",
    title: "Creator & Indie Hacker",
    avatar: "PK",
  },
];

const Testimonials = () => {
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
            Loved by <span className="gradient-text">builders</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="glass-panel-hover p-7 flex flex-col"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={14} className="fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed flex-1">"{t.quote}"</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-glow-cyan/30 to-glow-violet/30 flex items-center justify-center text-xs font-semibold text-foreground">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.title}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
