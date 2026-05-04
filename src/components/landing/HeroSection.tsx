import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Sparkles, Zap, Shield, CreditCard, Timer, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroMockup from "@/assets/hero-mockup.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background effects */}
      <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-glow-indigo/8 blur-[120px] animate-glow-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-glow-cyan/6 blur-[100px] animate-glow-pulse" style={{ animationDelay: "1.5s" }} />

      <div className="container-narrow section-padding relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-8"
            >
              <Sparkles size={14} />
              Now in public beta
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-balance"
            >
              Build mobile apps{" "}
              <span className="gradient-text">from plain English</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 text-balance"
            >
              Describe your app idea in a sentence. Our AI generates a polished,
              native-feel mobile app you can iterate on and launch — in minutes, not months.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)] text-base px-8 group"
              >
                <Link to="/generator">
                  Start Building Free
                  <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/60 text-foreground hover:bg-muted/50 text-base px-8 group"
              >
                <a href="#how-it-works">
                  <Play size={16} className="mr-2" />
                  Watch Demo
                </a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5"><CreditCard size={14} className="text-primary" /> Free 14-day trial — no card required, auto-switches to Free plan after</span>
              <span className="flex items-center gap-1.5"><Timer size={14} className="text-primary" /> Prototype in under 5 min</span>
              <span className="flex items-center gap-1.5"><Shield size={14} className="text-primary" /> You own the code</span>
              <span className="flex items-center gap-1.5"><Lock size={14} className="text-primary" /> SOC 2-ready infra</span>
            </motion.div>
          </div>

          {/* Right: Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-[var(--shadow-glow-lg)]">
              <img
                src={heroMockup}
                alt="AI app builder interface showing a smartphone with a generated fitness app and a text prompt"
                width={1280}
                height={800}
                className="w-full h-auto"
              />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-glow-cyan/20 via-glow-indigo/10 to-glow-violet/20 blur-xl -z-10 animate-glow-pulse" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
