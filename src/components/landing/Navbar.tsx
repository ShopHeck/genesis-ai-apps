import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, signOut } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Showcase", href: "#showcase" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "#faq" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, plan, monthlyUsage } = useAuth();

  const planLimit = plan === "studio" ? "∞" : plan === "pro" ? "30" : "3";
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <>
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container-narrow flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="font-display text-xl font-bold tracking-tight text-foreground">
            <span className="gradient-text">Apex</span>Build
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 border border-border/60 bg-card/40 hover:bg-card/70 transition-colors text-sm"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                    {initials}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {monthlyUsage}/{planLimit}
                  </span>
                  <ChevronDown size={13} className="text-muted-foreground" />
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="absolute right-0 top-full mt-2 w-48 glass-panel py-1 shadow-[var(--shadow-glow-sm)] z-50"
                    >
                      <div className="px-3 py-2 border-b border-border/40">
                        <p className="text-xs font-medium text-foreground truncate">{user.email}</p>
                        <p className="text-[10px] text-primary capitalize mt-0.5">{plan} plan</p>
                      </div>
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <LayoutDashboard size={14} />
                        Dashboard
                      </Link>
                      <Link
                        to="/pricing"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Upgrade plan
                      </Link>
                      <button
                        onClick={() => { signOut(); setUserMenuOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors w-full"
                      >
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setShowAuth(true)}
              >
                Log in
              </Button>
            )}
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)]">
              <Link to="/generator">Start Building</Link>
            </Button>
          </div>

          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border/40 overflow-hidden"
            >
              <div className="px-4 py-4 flex flex-col gap-3">
                {navLinks.map((link) =>
                  link.href.startsWith("#") ? (
                    <a
                      key={link.label}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-sm text-muted-foreground hover:text-foreground py-2"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      to={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-sm text-muted-foreground hover:text-foreground py-2"
                    >
                      {link.label}
                    </Link>
                  )
                )}
                {user ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="text-sm text-muted-foreground hover:text-foreground py-2 flex items-center gap-2"
                      onClick={() => setMobileOpen(false)}
                    >
                      <LayoutDashboard size={14} /> Dashboard
                    </Link>
                    <button
                      onClick={() => { signOut(); setMobileOpen(false); }}
                      className="text-sm text-muted-foreground hover:text-foreground py-2 flex items-center gap-2"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setShowAuth(true); setMobileOpen(false); }}
                    className="text-sm text-muted-foreground hover:text-foreground py-2"
                  >
                    Log in
                  </button>
                )}
                <Button asChild size="sm" className="mt-2 bg-primary text-primary-foreground">
                  <Link to="/generator" onClick={() => setMobileOpen(false)}>Start Building</Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

export default Navbar;
