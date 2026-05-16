import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Download,
  FileCode2,
  Folder,
  Apple,
  Wand2,
  AlertTriangle,
  Check,
  TerminalSquare,
  Crown,
  Pencil,
  RotateCcw,
  LayoutDashboard,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getPlanLimit } from "@/hooks/useAuth";
import AuthModal from "@/components/AuthModal";

import type { Project, Stage, LogKind, LogLine } from "@/components/generator/types";
import { STAGES, STAGE_SCRIPT } from "@/components/generator/stage-config";
import { buildTree, FileTreeView } from "@/components/generator/FileTree";
import { ZipPreviewCard } from "@/components/generator/ZipPreviewCard";
import { validateProject, ValidationPanel } from "@/components/generator/ValidationPanel";
import { AppPreview } from "@/components/generator/AppPreview";
import { PreviewPlayground } from "@/components/generator/PreviewPlayground";
import { RefinementChat } from "@/components/generator/RefinementChat";
import { XcodeExportButton } from "@/components/generator/XcodeExport";
import { EXAMPLE_PROMPTS } from "@/data/prompt-templates";

export default function Generator() {
  const { user, plan, monthlyUsage } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<"gemini" | "anthropic" | "opencode">("gemini");
  const [stage, setStage] = useState<Stage>("idle");
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastPromptUsed, setLastPromptUsed] = useState<string>("");
  const [showAuth, setShowAuth] = useState(false);
  const [regeneratingFile, setRegeneratingFile] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const startedAt = useRef<number | null>(null);
  const logIdRef = useRef(0);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const planLimit = getPlanLimit(plan);

  const loading = stage === "analyzing" || stage === "generating" || stage === "bundling";

  const pushLog = (kind: LogKind, text: string) => {
    setLogs((prev) => [...prev, { id: ++logIdRef.current, ts: Date.now(), kind, text }]);
  };

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (stage !== "analyzing" && stage !== "generating" && stage !== "bundling") return;
    const queue = [...STAGE_SCRIPT[stage]];
    let cancelled = false;
    const drip = () => {
      if (cancelled || queue.length === 0) return;
      const next = queue.shift()!;
      pushLog(next.kind, next.text);
      const delay = 600 + Math.random() * 1200;
      setTimeout(drip, delay);
    };
    const t = setTimeout(drip, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [stage]);

  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);


  const handleGenerate = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Describe your app in a bit more detail.");
      return;
    }

    if (user && monthlyUsage >= planLimit) {
      toast.error(`Monthly limit reached (${monthlyUsage}/${planLimit}). Upgrade your plan.`);
      return;
    }

    if (!user) {
      const anonUses = parseInt(localStorage.getItem("apexbuild_anon_uses") ?? "0", 10);
      if (anonUses >= 1) {
        setShowAuth(true);
        toast.info("Sign in to get 3 free builds per month.");
        return;
      }
    }

    setError(null);
    setProject(null);
    setSelectedFile(null);
    setEditedFiles(new Map());
    setElapsed(0);
    setLogs([]);
    setPreviewHtml(null);
    setPreviewError(null);
    logIdRef.current = 0;
    startedAt.current = Date.now();
    setLastPromptUsed(prompt);
    setStage("analyzing");
    pushLog("system", `> prompt received (${prompt.trim().length} chars)`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const fnUrl = `${supabaseUrl}/functions/v1/generate-ios-app`;

      const resp = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
        },
        body: JSON.stringify({ prompt, provider }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        let errMsg = `Generation failed (${resp.status})`;
        try {
          const j = JSON.parse(errText);
          errMsg = j.error ?? j.message ?? (j.code ? `${j.code}: ${j.message ?? ""}`.trim() : null) ?? errMsg;
        } catch {
          if (errText) errMsg = errText.slice(0, 200);
        }
        throw new Error(errMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;

          let event: { type: string; [key: string]: unknown };
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "progress") {
            const phase = event.phase as string;
            const message = event.message as string;
            const percent = event.percent as number;
            const isRetry = phase === "retrying";
            const kind: LogKind = phase === "done" ? "success"
              : isRetry ? "warning"
              : phase === "error" ? "error"
              : phase === "bundling" ? "action"
              : phase === "generating" ? "action"
              : "thought";
            pushLog(kind, message ?? phase);
            if (!isRetry && percent >= 0) {
              if (percent >= 85) setStage("bundling");
              else if (percent >= 30) setStage("generating");
              else setStage("analyzing");
            }
          } else if (event.type === "result") {
            const data = event.project as Project & { plan?: unknown };
            if (!data?.files?.length) throw new Error("Empty project returned.");
            pushLog("success", `[codegen] generated ${data.files.length} files for "${data.appName}"`);

            if (!user) {
              const cur = parseInt(localStorage.getItem("apexbuild_anon_uses") ?? "0", 10);
              localStorage.setItem("apexbuild_anon_uses", String(cur + 1));
            }

            setProject(data as Project);
            setSelectedFile(data.files[0].path);
            setStage("done");
            pushLog("success", "[done] project ready · awaiting download");
            toast.success(`${data.appName} generated — ${data.files.length} files`);

            if (!user) {
              setTimeout(() => {
                toast.info("Sign up to save this project and get more builds", {
                  action: { label: "Sign in", onClick: () => setShowAuth(true) },
                  duration: 8000,
                });
              }, 2000);
            }
          } else if (event.type === "patch") {
            const patchedFiles = (event.files as Project["files"]) ?? [];
            if (patchedFiles.length > 0) {
              setProject(prev => prev ? { ...prev, files: patchedFiles } : prev);
              const score = event.reviewScore as number | undefined;
              pushLog("action", `[reviewer] quality score: ${score ?? "—"}/100 · ${patchedFiles.length} files patched`);
              toast.info("Review complete — files updated with quality fixes");
            }
          } else if (event.type === "review") {
            const score = event.reviewScore as number | undefined;
            pushLog("success", `[reviewer] quality score: ${score ?? "—"}/100 · approved`);
          } else if (event.type === "error") {
            throw new Error((event.message as string) ?? "Generation failed");
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      setStage("error");
      pushLog("error", `[error] ${msg}`);
      toast.error(msg);
    }
  };

  const handleRegenerateFile = async () => {
    if (!project || !selectedFile || !user) {
      if (!user) { setShowAuth(true); return; }
      return;
    }
    if (plan === "free") {
      toast.error("File regeneration requires a Pro or Studio plan.");
      return;
    }
    setRegeneratingFile(true);
    try {
      const currentContent = editedFiles.get(selectedFile) ?? project.files.find(f => f.path === selectedFile)?.content ?? "";
      const { data, error: fnErr } = await supabase.functions.invoke("regenerate-file", {
        body: {
          filePath: selectedFile,
          currentContent,
          prompt: lastPromptUsed,
          appContext: { appName: project.appName, summary: project.summary },
          provider,
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (data?.content) {
        setEditedFiles(prev => new Map(prev).set(selectedFile, data.content));
        toast.success("File regenerated");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegeneratingFile(false);
    }
  };

  const validation = project ? validateProject(project) : null;

  const handleDownload = async () => {
    if (!project) return;
    if (validation && validation.errors.length > 0) {
      toast.error("Cannot download: project has validation errors");
      return;
    }
    const zip = new JSZip();
    const root = zip.folder(project.appName)!;
    project.files.forEach((f) => root.file(f.path, editedFiles.get(f.path) ?? f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${project.appName}.zip`);
    toast.success("Project downloaded");
  };

  const generatePreview = async () => {
    if (!project) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const fileManifest = project.files
        .map((f) => f.path)
        .join("\n");

      const { data, error: fnErr } = await supabase.functions.invoke("generate-app-preview", {
        body: {
          prompt: lastPromptUsed || prompt,
          appName: project.appName,
          summary: project.summary,
          plan: project.plan ?? null,
          fileManifest,
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.html) throw new Error("Empty preview returned");
      setPreviewHtml(data.html);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Preview failed";
      setPreviewError(msg);
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (project && !previewHtml && !previewLoading && !previewError) {
      generatePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);


  const tree = project ? buildTree(project.files) : null;
  const currentFile = project?.files.find((f) => f.path === selectedFile);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} reason="Sign in to unlock more builds" />

      {/* Top bar */}
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
            <span className="text-muted-foreground font-normal">/ Generator</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <Apple size={14} />
              <span>Xcode 16+ · iOS 18 · Swift 6</span>
            </div>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {monthlyUsage}/{planLimit === Infinity ? "\u221E" : planLimit} builds
                </span>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-7 px-2">
                    <LayoutDashboard size={14} />
                  </Button>
                </Link>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground h-7" onClick={() => setShowAuth(true)}>
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Prompt panel */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-panel p-6 sm:p-8 mb-8 relative overflow-hidden"
        >
          <div
            className="absolute -top-32 -right-32 w-72 h-72 rounded-full blur-[100px] opacity-30 pointer-events-none"
            style={{ background: "var(--gradient-glow)" }}
          />

          <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
            <Sparkles size={14} />
            Describe your iOS app
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-balance">
            From idea to <span className="gradient-text">Xcode project</span> in seconds
          </h1>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            Generates a production-grade SwiftUI app following Apple's 2026 best practices —
            Swift 6 concurrency, @Observable, SwiftData, NavigationStack, and accessibility built in.
          </p>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A meditation app with guided breathing sessions, daily streaks, and HealthKit integration..."
            rows={4}
            className="bg-background/60 border-border/60 resize-none text-base focus-visible:ring-primary"
            disabled={loading}
          />

          <div className="mt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
                Out-of-the-box idea templates
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                {EXAMPLE_PROMPTS.length} curated · click to load
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
              {EXAMPLE_PROMPTS.map((ex) => {
                const selected = prompt === ex.prompt;
                return (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setPrompt(ex.prompt)}
                    disabled={loading}
                    title={ex.prompt}
                    className={`group relative text-left rounded-xl border p-3.5 bg-card/40 hover:bg-card/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                      selected
                        ? "border-primary/60 shadow-[var(--shadow-glow-sm)]"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                    style={{
                      backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${ex.accent}22, transparent 60%)`,
                    }}
                  >
                    <div className="flex items-start gap-2.5 mb-2">
                      <div
                        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg ring-1 ring-inset ring-white/10"
                        style={{
                          background: `linear-gradient(135deg, ${ex.accent}55, ${ex.accent}1a)`,
                        }}
                        aria-hidden
                      >
                        {ex.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[10px] uppercase tracking-wider font-medium"
                          style={{ color: ex.accent }}
                        >
                          {ex.category}
                        </p>
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {ex.label}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2 mb-2.5">
                      {ex.tagline}
                    </p>

                    <div className="flex items-start gap-1.5 text-[11px] text-foreground/80 mb-2.5">
                      <Sparkles
                        size={11}
                        className="mt-0.5 shrink-0"
                        style={{ color: ex.accent }}
                      />
                      <span className="line-clamp-2 leading-snug">{ex.signature}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {ex.screens.map((s) => (
                        <span
                          key={s}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 border border-border/50 text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    {selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Wand2 size={12} /> Powered by{" "}
                {provider === "gemini" ? "Gemini 2.5 Pro" : provider === "anthropic" ? "Claude Opus 4.7" : "Opencode Zen"}
              </p>
              <div className="flex items-center gap-1.5 bg-card/60 border border-border/60 rounded-lg px-2 py-1">
                <span className="text-xs text-muted-foreground">Provider:</span>
                <button
                  onClick={() => setProvider("gemini")}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${provider === "gemini" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Gemini
                </button>
                {plan === "studio" && (
                  <>
                    <button
                      onClick={() => setProvider("anthropic")}
                      className={`text-xs px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${provider === "anthropic" ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Crown size={10} /> Claude
                    </button>
                    <button
                      onClick={() => setProvider("opencode")}
                      className={`text-xs px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${provider === "opencode" ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Crown size={10} /> Opencode
                    </button>
                  </>
                )}
              </div>

              {user && planLimit !== Infinity && (
                <span className={`text-xs ${monthlyUsage >= planLimit ? "text-destructive" : "text-muted-foreground"}`}>
                  {monthlyUsage}/{planLimit} builds this month
                  {monthlyUsage >= planLimit && (
                    <Link to="/pricing" className="ml-1 text-primary underline">Upgrade</Link>
                  )}
                </span>
              )}
              {!user && (
                <button onClick={() => setShowAuth(true)} className="text-xs text-primary underline">
                  Sign in for 3 free builds/mo
                </button>
              )}
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)] min-w-[180px]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate App
                </>
              )}
            </Button>
          </div>
        </motion.section>

        {/* Multi-step progress */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass-panel p-6 sm:p-8 mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-primary font-medium">
                    Building your app
                  </p>
                  <h2 className="font-display text-xl font-semibold mt-1">
                    {STAGES.find((s) => s.id === stage)?.label ?? "Working…"}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                    {elapsed}s
                  </p>
                  <p className="text-xs text-muted-foreground">~20–60s typical</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-card/60 overflow-hidden mb-6">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--gradient-glow)" }}
                  initial={{ width: "5%" }}
                  animate={{
                    width:
                      stage === "analyzing"
                        ? "25%"
                        : stage === "generating"
                          ? "70%"
                          : stage === "bundling"
                            ? "95%"
                            : "100%",
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>

              {/* Steps */}
              <ol className="space-y-3">
                {STAGES.filter((s) => s.id !== "done").map((step, i) => {
                  const order = ["analyzing", "generating", "bundling"];
                  const currentIdx = order.indexOf(stage);
                  const stepIdx = order.indexOf(step.id);
                  const status: "pending" | "active" | "complete" =
                    stepIdx < currentIdx
                      ? "complete"
                      : stepIdx === currentIdx
                        ? "active"
                        : "pending";
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.id}
                      className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                        status === "active"
                          ? "bg-primary/5 border border-primary/30"
                          : "border border-transparent"
                      }`}
                    >
                      <div
                        className={`shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center ${
                          status === "complete"
                            ? "bg-primary/15 text-primary"
                            : status === "active"
                              ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-sm)]"
                              : "bg-card/60 text-muted-foreground"
                        }`}
                      >
                        {status === "complete" ? (
                          <Check size={14} strokeWidth={3} />
                        ) : status === "active" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Icon size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium ${
                            status === "pending" ? "text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground/80 mt-0.5">{step.hint}</p>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground/60 mt-1">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {/* Live agent terminal */}
              <div className="mt-6 rounded-xl border border-border/60 bg-[hsl(228_20%_4%)] overflow-hidden shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                    <span className="ml-3 text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                      <TerminalSquare size={12} /> apex-agent — building
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    {logs.length} lines
                  </span>
                </div>
                <div
                  ref={terminalRef}
                  className="font-mono text-[12px] leading-relaxed p-4 h-64 overflow-auto"
                >
                  {logs.map((l) => {
                    const color =
                      l.kind === "system"
                        ? "text-foreground"
                        : l.kind === "thought"
                          ? "text-muted-foreground"
                          : l.kind === "action"
                            ? "text-primary"
                            : l.kind === "success"
                              ? "text-emerald-400"
                              : l.kind === "warning"
                                ? "text-amber-400"
                                : "text-destructive";
                    const time = new Date(l.ts).toLocaleTimeString([], {
                      hour12: false,
                      minute: "2-digit",
                      second: "2-digit",
                    });
                    return (
                      <div key={l.id} className="flex gap-3">
                        <span className="text-muted-foreground/40 shrink-0">{time}</span>
                        <span className={`${color} whitespace-pre-wrap break-words`}>
                          {l.text}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex gap-2 items-center mt-1 text-primary">
                    <span>›</span>
                    <span className="inline-block w-2 h-4 bg-primary/80 animate-pulse" />
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>


        {/* Error */}
        {error && !loading && (
          <div className="glass-panel border-destructive/40 p-6 flex items-start gap-3">
            <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-medium text-foreground">Generation failed</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <button
                onClick={handleGenerate}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <RotateCcw size={14} />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {project && !loading && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Summary header */}
              <div className="glass-panel p-6 flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-primary font-medium mb-1">
                    <Apple size={12} /> READY FOR XCODE
                  </div>
                  <h2 className="font-display text-2xl font-bold">{project.appName}</h2>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{project.bundleId}</p>
                  <p className="text-sm text-muted-foreground mt-3 max-w-2xl">{project.summary}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {project.files.length} files generated
                  </p>
                </div>
                <Button
                  onClick={handleDownload}
                  size="lg"
                  disabled={!!validation && validation.errors.length > 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)] disabled:opacity-50"
                >
                  <Download size={16} />
                  Download .zip
                </Button>
              </div>

              {/* Interactive app preview */}
              <AppPreview
                html={previewHtml}
                loading={previewLoading}
                error={previewError}
                onRegenerate={generatePreview}
                appName={project.appName}
                onOpenPlayground={() => setShowPlayground(true)}
              />

              {/* Live Code Playground */}
              {showPlayground && previewHtml && (
                <PreviewPlayground
                  html={previewHtml}
                  appName={project.appName}
                  onHtmlChange={(html) => setPreviewHtml(html)}
                />
              )}

              {/* Iterative Refinement Chat */}
              <RefinementChat
                project={project}
                prompt={lastPromptUsed}
                provider={provider}
                onProjectUpdate={(updated) => {
                  setProject(updated);
                  setSelectedFile(updated.files[0]?.path ?? null);
                }}
              />

              {/* Pre-download validation */}
              {validation && <ValidationPanel result={validation} onSelect={setSelectedFile} />}

              {/* ZIP Preview summary */}
              <ZipPreviewCard project={project} onSelect={setSelectedFile} />

              {/* Code viewer */}
              <div className="grid lg:grid-cols-[280px_1fr] gap-4 min-h-[500px]">
                {/* File tree */}
                <div className="glass-panel p-3 overflow-auto max-h-[600px]">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-2 flex items-center gap-1.5">
                    <Folder size={12} /> {project.appName}
                  </div>
                  <FileTreeView
                    node={tree!}
                    selected={selectedFile}
                    onSelect={setSelectedFile}
                  />
                </div>

                {/* File content */}
                <div className="glass-panel overflow-hidden flex flex-col min-h-[500px]">
                  <div className="border-b border-border/40 px-4 py-2 flex items-center justify-between gap-2 bg-card/40">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground min-w-0">
                      <FileCode2 size={12} className="shrink-0" />
                      <span className="truncate">{selectedFile}</span>
                      {selectedFile && editedFiles.has(selectedFile) && (
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">edited</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {plan !== "free" && selectedFile && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-border/60 hover:border-primary/40"
                          onClick={handleRegenerateFile}
                          disabled={regeneratingFile}
                          title="Regenerate this file with AI"
                        >
                          {regeneratingFile ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          <span className="ml-1.5 hidden sm:inline">Regenerate</span>
                        </Button>
                      )}
                      {plan === "free" && selectedFile && (
                        <button
                          onClick={() => setShowAuth(true)}
                          className="text-[10px] text-primary/70 flex items-center gap-1 hover:text-primary"
                          title="Upgrade to Pro to edit files"
                        >
                          <Pencil size={10} /> Upgrade to edit
                        </button>
                      )}
                    </div>
                  </div>

                  {plan !== "free" ? (
                    <Editor
                      height="560px"
                      theme="vs-dark"
                      language={
                        selectedFile?.endsWith(".swift") ? "swift" :
                        selectedFile?.endsWith(".yml") || selectedFile?.endsWith(".yaml") ? "yaml" :
                        selectedFile?.endsWith(".json") ? "json" :
                        selectedFile?.endsWith(".md") ? "markdown" :
                        selectedFile?.endsWith(".gitignore") ? "ini" : "plaintext"
                      }
                      value={editedFiles.get(selectedFile ?? "") ?? currentFile?.content ?? ""}
                      onChange={(val) => {
                        if (selectedFile && val !== undefined) {
                          setEditedFiles(prev => new Map(prev).set(selectedFile, val));
                        }
                      }}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        readOnly: false,
                        automaticLayout: true,
                      }}
                    />
                  ) : (
                    <div className="relative flex-1 overflow-auto">
                      <pre className="p-4 text-xs font-mono text-foreground/90 leading-relaxed">
                        <code>{currentFile?.content ?? ""}</code>
                      </pre>
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                        <button
                          onClick={() => setShowAuth(true)}
                          className="glass-panel px-4 py-2 text-xs text-primary border-primary/30 hover:border-primary/60 transition-colors flex items-center gap-2"
                        >
                          <Pencil size={12} />
                          Upgrade to Pro to edit files in-browser
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Xcode Project Export */}
              <XcodeExportButton
                project={project}
                editedFiles={editedFiles}
                validation={validation}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
