import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FooterCTA = () => {
  return (
    <>
      {/* Final CTA */}
      <section className="section-padding relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-glow-cyan/5 blur-[150px]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="container-narrow text-center relative z-10"
        >
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Ready to build your <span className="gradient-text">next app</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join thousands of founders shipping apps faster than ever. Start free today.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)] text-base px-10 group"
          >
            <Link to="/generator">
              Start Building Free
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12 px-4 sm:px-6 lg:px-8">
        <div className="container-narrow flex flex-col md:flex-row items-center justify-between gap-6">
          <a href="#" className="font-display text-lg font-bold">
            <span className="gradient-text">Apex</span>Build
          </a>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
            <a href="#" className="hover:text-foreground transition-colors">Discord</a>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 ApexBuild. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default FooterCTA;
