import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Download,
  FileCode2,
  Folder,
  Store,
  Globe,
  Wand2,
  AlertTriangle,
  Check,
  Crown,
  Pencil,
  RotateCcw,
  LayoutDashboard,
  Eye,
  Code2,
  Layers,
  Terminal,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { downloadZip } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getPlanLimit } from "@/hooks/useAuth";
import { useGeneration } from "@/hooks/useGeneration";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AuthModal from "@/components/AuthModal";

import { buildTree, FileTreeView } from "@/components/generator/FileTree";
import { ZipPreviewCard } from "@/components/generator/ZipPreviewCard";
import { RefinementChat } from "@/components/generator/RefinementChat";
import { QualityScore } from "@/components/generator/QualityScore";
import { CompliancePanel } from "@/components/generator/CompliancePanel";
import { LiveSandbox } from "@/components/generator/LiveSandbox";
import { TerminalPanel } from "@/components/generator/TerminalPanel";
import { EXAMPLE_PROMPTS } from "@/data/prompt-templates";

type Target = "shopify" | "web";

export default function Generator() {
  const { user, plan, monthlyUsage } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState<Target>("shopify");
  const [parentGenerationId, setParentGenerationId] = useState<string | null>(null);
  const [remixMode, setRemixMode] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "anthropic" | "opencode">("gemini");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Map<string, string>>(new Map());
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [regeneratingFile, setRegeneratingFile] = useState(false);
  const [resultTab, setResultTab] = useState<"preview" | "code" | "details">("preview");

  const generation = useGeneration();
  const { stage, project, error, elapsed, logs, loading, lastPromptUsed, terminalRef } = generation;

  const planLimit = getPlanLimit(plan);

  // Handle query params from Dashboard (re-generate / remix)
  useEffect(() => {
    const regenerateId = searchParams.get("regenerate");
    const remixId = searchParams.get("remix");
    const prefillPrompt = searchParams.get("prompt");
    const prefillTarget = searchParams.get("target") as Target | null;

    if (prefillPrompt) setPrompt(decodeURIComponent(prefillPrompt));
    if (prefillTarget === "shopify" || prefillTarget === "web") setTarget(prefillTarget);

    if (regenerateId) {
      setParentGenerationId(regenerateId);
      setRemixMode(false);
      toast.info("Re-generating from previous build");
    } else if (remixId) {
      setParentGenerationId(remixId);
      setRemixMode(true);
      toast.info("Remix mode — edit the prompt and generate");
    }

    if (regenerateId || remixId) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync selected file from project when it first loads
  useEffect(() => {
    if (project && !selectedFile && project.files.length > 0) {
      setSelectedFile(project.files[0].path);
    }
  }, [project, selectedFile]);

  const handleGenerate = async () => {
    setSelectedFile(null);
    setEditedFiles(new Map());
    setPreviewHtml(null);
    await generation.generate({
      prompt,
      target,
      provider,
      user,
      monthlyUsage,
      planLimit,
      onAuthRequired: () => setShowAuth(true),
    });
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

  const handleDownload = async () => {
    if (!project) return;
    const files = project.files.map((f) => ({ path: f.path, content: editedFiles.get(f.path) ?? f.content }));
    await downloadZip(project.appName, files);
    toast.success("Project downloaded");
  };

  const tree = project ? buildTree(project.files) : null;
  const currentFile = project?.files.find((f) => f.path === selectedFile);
  const isShopify = target === "shopify";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Generator — ApexBuild</title>
      </Helmet>
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
              <Store size={14} />
              <span>{isShopify ? "Shopify · React Router · Polaris" : "React · Tailwind · Vite"}</span>
            </div>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {monthlyUsage}/{planLimit === Infinity ? "∞" : planLimit} builds
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
            Describe your app
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2 text-balance">
            From idea to <span className="gradient-text">{isShopify ? "Shopify app" : "web app"}</span> in seconds
          </h1>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            {isShopify
              ? "Generates an installable embedded Shopify admin app on the official React Router template — App Bridge, Polaris UI, Admin GraphQL, webhooks, and Prisma session storage wired in."
              : "Generates a production-grade React + Tailwind CSS app with TypeScript, responsive design, animations, and accessibility built in."
            }
          </p>

          {/* Target selector */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-1 bg-card/40 rounded-lg p-1 border border-border/40">
              <button
                onClick={() => setTarget("shopify")}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isShopify
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Store size={13} />
                Shopify App
              </button>
              <button
                onClick={() => setTarget("web")}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  target === "web"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe size={13} />
                Web App
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground/60">
              {isShopify ? "React Router + Polaris + Admin API" : "React + Tailwind + Vite"}
            </span>
          </div>

          {/* Remix / Re-generate indicator */}
          {parentGenerationId && (
            <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border text-xs ${
              remixMode
                ? "bg-violet-400/10 border-violet-400/30 text-violet-300"
                : "bg-emerald-400/10 border-emerald-400/30 text-emerald-300"
            }`}>
              {remixMode ? (
                <>
                  <Pencil size={12} />
                  <span>Remix mode — edit the prompt below, then generate a new version</span>
                </>
              ) : (
                <>
                  <RotateCcw size={12} />
                  <span>Re-generating from previous build — click Generate to start</span>
                </>
              )}
              <button
                onClick={() => { setParentGenerationId(null); setRemixMode(false); }}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isShopify
              ? "A low-stock alert app that flags products under a threshold and lets merchants set per-product reorder points..."
              : "A meditation app with guided breathing sessions, daily streaks, and offline support..."}
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

        {/* Multi-step progress + terminal */}
        <TerminalPanel
          stage={stage}
          target={target}
          elapsed={elapsed}
          logs={logs}
          terminalRef={terminalRef}
          loading={loading}
        />

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
                    {isShopify ? <Store size={12} /> : <Globe size={12} />}
                    {isShopify ? "READY TO INSTALL" : "READY TO DEPLOY"}
                  </div>
                  <h2 className="font-display text-2xl font-bold">{project.appName}</h2>
                  <p className="text-sm text-muted-foreground mt-3 max-w-2xl">{project.summary}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2">
                    {project.files.length} files generated
                    {isShopify && project.files.some(f => f.path.includes("prisma/")) && (
                      <span className="ml-2 text-primary/70">· Prisma data layer</span>
                    )}
                    {isShopify && project.files.some(f => f.path.includes("webhooks")) && (
                      <span className="ml-1 text-primary/70">· webhooks wired</span>
                    )}
                  </p>
                </div>
                <Button
                  onClick={handleDownload}
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)]"
                >
                  <Download size={16} />
                  Download .zip
                </Button>
              </div>

              {/* Tab Bar */}
              <div className="flex gap-1 p-1 bg-card/40 rounded-xl border border-border/40">
                {([
                  { id: "preview" as const, label: isShopify ? "Install" : "Preview", icon: Eye },
                  { id: "code" as const, label: "Code", icon: Code2 },
                  { id: "details" as const, label: "Details", icon: Layers },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setResultTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      resultTab === tab.id
                        ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-sm)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Preview / Install Tab */}
              {resultTab === "preview" && (
                <ErrorBoundary>
                  {target === "web" ? (
                    <LiveSandbox
                      project={project}
                      target={target}
                      onPreviewHtml={(html) => setPreviewHtml(html)}
                    />
                  ) : (
                    <ShopifyInstallPanel appName={project.appName} />
                  )}
                </ErrorBoundary>
              )}

              {/* Code Tab */}
              {resultTab === "code" && (
                <ErrorBoundary>
                  <ZipPreviewCard project={project} onSelect={(f) => { setSelectedFile(f); }} />
                  <div className="grid lg:grid-cols-[280px_1fr] gap-4 min-h-[500px]">
                    <div className="glass-panel p-3 overflow-auto max-h-[600px]">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-2 flex items-center gap-1.5">
                        <Folder size={12} /> {project.appName}
                      </div>
                      <FileTreeView node={tree!} selected={selectedFile} onSelect={setSelectedFile} />
                    </div>
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
                            selectedFile?.endsWith(".tsx") || selectedFile?.endsWith(".jsx") ? "typescript" :
                            selectedFile?.endsWith(".ts") || selectedFile?.endsWith(".js") ? "typescript" :
                            selectedFile?.endsWith(".css") ? "css" :
                            selectedFile?.endsWith(".prisma") ? "prisma" :
                            selectedFile?.endsWith(".sql") ? "sql" :
                            selectedFile?.endsWith(".html") ? "html" :
                            selectedFile?.endsWith(".toml") ? "ini" :
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
                </ErrorBoundary>
              )}

              {/* Details Tab */}
              {resultTab === "details" && (
                <>
                  <RefinementChat
                    project={project}
                    prompt={lastPromptUsed}
                    provider={provider}
                    onProjectUpdate={(updated) => {
                      generation.setProject(updated);
                      setSelectedFile(updated.files[0]?.path ?? null);
                    }}
                  />
                  {isShopify && project.compliance && (
                    <CompliancePanel report={project.compliance} />
                  )}
                  <QualityScore project={project} previewHtml={previewHtml} />
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Install instructions for a generated Shopify app. A real in-admin embedded
// preview against a connected dev store lands in Phase 2.
function ShopifyInstallPanel({ appName }: { appName: string }) {
  const steps = [
    { cmd: "npm install", desc: "Install dependencies" },
    { cmd: "npm run setup", desc: "Generate the Prisma client + run migrations" },
    { cmd: "shopify app dev", desc: "Install on your dev store and open the embedded app" },
  ];
  return (
    <div className="glass-panel p-6 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Store size={16} className="text-primary" />
        Install <span className="gradient-text">{appName}</span> on a dev store
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">
        This is a complete Shopify app on the official React Router template. Download the
        .zip, then from the project root:
      </p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.cmd} className="flex items-start gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] flex items-center justify-center mt-0.5">{i + 1}</span>
            <div className="min-w-0">
              <code className="text-xs font-mono bg-background/60 border border-border/50 rounded px-2 py-1 inline-flex items-center gap-1.5">
                <Terminal size={11} className="text-muted-foreground" />
                {s.cmd}
              </code>
              <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="text-xs text-muted-foreground/70 border-t border-border/40 pt-4">
        Requires the{" "}
        <a href="https://shopify.dev/docs/api/shopify-cli" target="_blank" rel="noreferrer" className="text-primary underline">
          Shopify CLI
        </a>{" "}
        and a Partner account. A live in-admin preview against your connected store is coming soon.
      </div>
    </div>
  );
}
