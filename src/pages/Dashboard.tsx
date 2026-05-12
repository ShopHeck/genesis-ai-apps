import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Clock,
  Package,
  Loader2,
  LayoutGrid,
  Sparkles,
  Crown,
  Zap,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getPlanLimit } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";

type GenerationRecord = {
  id: string;
  app_name: string | null;
  bundle_id: string | null;
  summary: string | null;
  prompt: string;
  files_count: number | null;
  files: Array<{ path: string; content: string }> | null;
  model_used: string | null;
  status: string;
  created_at: string;
};

const PLAN_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  free: { label: "Free", color: "text-muted-foreground", icon: <Zap size={12} /> },
  pro: { label: "Pro", color: "text-primary", icon: <Sparkles size={12} /> },
  studio: { label: "Studio", color: "text-violet-400", icon: <Crown size={12} /> },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, plan, monthlyUsage, loading: authLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      setShowAuth(true);
    } else if (user) {
      fetchGenerations();
    }
  }, [user, authLoading]);

  async function fetchGenerations() {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from("generations")
        .select("id, app_name, bundle_id, summary, prompt, files_count, files, model_used, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setGenerations((data as GenerationRecord[]) ?? []);
    } catch (err) {
      toast.error("Failed to load projects");
    } finally {
      setLoadingData(false);
    }
  }

  const handleReDownload = async (gen: GenerationRecord) => {
    if (!gen.files || gen.files.length === 0) {
      toast.error("Project files not stored — regenerate from Generator");
      return;
    }
    const zip = new JSZip();
    const root = zip.folder(gen.app_name ?? "ApexBuild-App")!;
    gen.files.forEach((f) => root.file(f.path, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${gen.app_name ?? "app"}.zip`);
    toast.success("Project downloaded");
  };

  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.free;
  const limit = getPlanLimit(plan);
  const usagePercent = limit === Infinity ? 0 : Math.min((monthlyUsage / limit) * 100, 100);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthModal
        open={showAuth && !user}
        onClose={() => { setShowAuth(false); navigate("/"); }}
        reason="Sign in to view your dashboard"
      />

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <div className="font-display text-lg font-bold">
            <span className="gradient-text">Apex</span>Build{" "}
            <span className="text-muted-foreground font-normal">/ Dashboard</span>
          </div>
          <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)]">
            <Link to="/generator">
              <Sparkles size={14} className="mr-1.5" />
              New App
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Plan + usage card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`flex items-center gap-1 text-sm font-medium ${planInfo.color}`}>
                {planInfo.icon} {planInfo.label} Plan
              </span>
            </div>
            <p className="text-2xl font-display font-bold">
              {monthlyUsage}
              <span className="text-muted-foreground font-normal text-base">
                {" "}/ {limit === Infinity ? "∞" : limit} builds this month
              </span>
            </p>
            {limit !== Infinity && (
              <div className="mt-2 w-48 h-1.5 bg-border/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            )}
          </div>
          {plan === "free" && (
            <Button asChild variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
              <Link to="/pricing">
                <Crown size={14} className="mr-1.5" />
                Upgrade to Pro
              </Link>
            </Button>
          )}
        </motion.div>

        {/* Projects grid */}
        <div className="flex items-center gap-2 mb-5">
          <LayoutGrid size={16} className="text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">Your Projects</h2>
          <Badge variant="secondary" className="ml-1">{generations.length}</Badge>
        </div>

        {loadingData ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={28} />
          </div>
        ) : generations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel p-12 text-center"
          >
            <Package size={40} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Generate your first iOS app and it will appear here.
            </p>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-sm)]">
              <Link to="/generator">
                <Sparkles size={14} className="mr-1.5" />
                Build your first app
              </Link>
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {generations.map((gen, i) => (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-panel p-5 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">
                      {gen.app_name ?? "Unnamed App"}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {gen.bundle_id ?? ""}
                    </p>
                  </div>
                  <Badge
                    variant={gen.status === "success" ? "default" : "destructive"}
                    className="ml-2 shrink-0 text-[10px]"
                  >
                    {gen.status}
                  </Badge>
                </div>

                {gen.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {gen.summary}
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Package size={11} /> {gen.files_count ?? 0} files
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(gen.created_at).toLocaleDateString()}
                  </span>
                  {gen.model_used && (
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} /> {gen.model_used.includes("claude") ? "Claude" : "Gemini"}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-border/60 hover:border-primary/40 hover:bg-primary/5 text-xs"
                    onClick={() => handleReDownload(gen)}
                    disabled={!gen.files || gen.files.length === 0}
                  >
                    <Download size={13} className="mr-1.5" />
                    Download
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
