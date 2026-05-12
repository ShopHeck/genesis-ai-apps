import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, X, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export default function AuthModal({ open, onClose, reason }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/generator` },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/generator` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative glass-panel w-full max-w-md p-8 border-primary/20 shadow-[var(--shadow-glow-md)]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-primary font-medium mb-1">Sign in</p>
          <h2 className="font-display text-2xl font-bold">
            {reason ?? "Create a free account"}
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            Save projects, track usage, and unlock more builds.
          </p>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail size={22} className="text-primary" />
            </div>
            <p className="font-semibold text-foreground mb-1">Check your inbox</p>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in instantly.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleMagicLink} className="space-y-3 mb-4">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/60 border-border/60 focus-visible:ring-primary"
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)]"
              >
                {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mail size={16} className="mr-2" />}
                Send magic link
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card text-xs text-muted-foreground px-2">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-border/60 hover:bg-card/60"
              onClick={handleGoogle}
            >
              <Chrome size={16} className="mr-2" />
              Continue with Google
            </Button>
          </>
        )}

        <p className="text-[11px] text-muted-foreground/60 text-center mt-5">
          By signing in you agree to our terms of service and privacy policy.
        </p>
      </motion.div>
    </div>
  );
}
