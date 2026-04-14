import { motion } from "framer-motion";

const logos = ["LaunchPad", "IndieStack", "BuilderHQ", "ShipFast", "CreatorLabs", "NexGen"];

const SocialProofStrip = () => {
  return (
    <section className="border-y border-border/30 bg-muted/20">
      <div className="container-narrow px-4 sm:px-6 lg:px-8 py-10">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mb-8"
        >
          Trusted by 2,000+ founders and creators shipping faster
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4"
        >
          {logos.map((name) => (
            <span
              key={name}
              className="font-display text-lg font-semibold text-muted-foreground/40 select-none"
            >
              {name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default SocialProofStrip;
