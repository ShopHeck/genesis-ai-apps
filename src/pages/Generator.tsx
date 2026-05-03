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
  ChevronRight,
  Apple,
  Wand2,
  AlertTriangle,
  Check,
  Brain,
  Code2,
  Package,
  FileText,
  Eye,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type GeneratedFile = { path: string; content: string };
type Project = {
  appName: string;
  bundleId: string;
  summary: string;
  files: GeneratedFile[];
};

const EXAMPLE_PROMPTS = [
  "A minimalist habit tracker with streaks, daily reminders, and a clean SwiftUI charts dashboard.",
  "A focus timer app with Pomodoro sessions, ambient soundscapes, and Live Activities.",
  "A personal journal with mood tracking, on-device AI summaries, and Face ID lock.",
  "A workout logger with custom routines, rest timers, and SwiftData persistence.",
];

type Stage = "idle" | "analyzing" | "generating" | "bundling" | "done" | "error";

const STAGES: { id: Exclude<Stage, "idle" | "error">; label: string; hint: string; icon: typeof Brain }[] = [
  { id: "analyzing", label: "Analyzing your prompt", hint: "Designing app architecture & feature set", icon: Brain },
  { id: "generating", label: "Generating Swift source files", hint: "Writing SwiftUI views, models & SwiftData schema", icon: Code2 },
  { id: "bundling", label: "Bundling Xcode project", hint: "Packaging files into a downloadable .zip", icon: Package },
  { id: "done", label: "Ready for Xcode", hint: "Open in Xcode 16+, sign, and ship", icon: Check },
];

export default function Generator() {
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  const loading = stage === "analyzing" || stage === "generating" || stage === "bundling";

  // Tick elapsed seconds while loading
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [loading]);

  const handleGenerate = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Describe your app in a bit more detail.");
      return;
    }
    setError(null);
    setProject(null);
    setSelectedFile(null);
    setElapsed(0);
    startedAt.current = Date.now();
    setStage("analyzing");

    // Auto-advance from "analyzing" to "generating" after a short delay so the
    // user sees both phases even though they happen inside one network call.
    const analyzeTimer = setTimeout(() => {
      setStage((s) => (s === "analyzing" ? "generating" : s));
    }, 1800);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-ios-app", {
        body: { prompt },
      });
      clearTimeout(analyzeTimer);
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.files?.length) throw new Error("Empty project returned.");

      setStage("bundling");
      // Brief beat so the bundling step is visible
      await new Promise((r) => setTimeout(r, 500));

      setProject(data as Project);
      setSelectedFile(data.files[0].path);
      setStage("done");
      toast.success(`${data.appName} generated — ${data.files.length} files`);
    } catch (e) {
      clearTimeout(analyzeTimer);
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      setStage("error");
      toast.error(msg);
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
    project.files.forEach((f) => root.file(f.path, f.content));
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${project.appName}.zip`);
    toast.success("Project downloaded");
  };


  const tree = project ? buildTree(project.files) : null;
  const currentFile = project?.files.find((f) => f.path === selectedFile);

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Apple size={14} />
            <span className="hidden sm:inline">Xcode 16+ · iOS 18 · Swift 6</span>
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

          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
              >
                {ex.split(" ").slice(0, 5).join(" ")}…
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6 gap-4 flex-wrap">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Wand2 size={12} /> Powered by Lovable AI · Gemini 2.5 Pro
            </p>
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
            </motion.div>
          )}
        </AnimatePresence>


        {/* Error */}
        {error && !loading && (
          <div className="glass-panel border-destructive/40 p-6 flex items-start gap-3">
            <AlertTriangle className="text-destructive shrink-0" size={20} />
            <div>
              <p className="font-medium text-foreground">Generation failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow-md)]"
                >
                  <Download size={16} />
                  Download .zip
                </Button>
              </div>

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
                  <div className="border-b border-border/40 px-4 py-2.5 flex items-center gap-2 text-xs font-mono text-muted-foreground bg-card/40">
                    <FileCode2 size={12} />
                    {selectedFile}
                  </div>
                  <pre className="overflow-auto flex-1 p-4 text-xs font-mono text-foreground/90 leading-relaxed">
                    <code>{currentFile?.content ?? ""}</code>
                  </pre>
                </div>
              </div>

              {/* Build instructions */}
              <div className="glass-panel p-6">
                <h3 className="font-display text-lg font-semibold mb-3">Open in Xcode</h3>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Download and unzip the project.</li>
                  <li>
                    Install{" "}
                    <code className="text-primary text-xs bg-card/60 px-1.5 py-0.5 rounded">
                      brew install xcodegen
                    </code>{" "}
                    (one-time).
                  </li>
                  <li>
                    Run{" "}
                    <code className="text-primary text-xs bg-card/60 px-1.5 py-0.5 rounded">
                      xcodegen generate
                    </code>{" "}
                    inside the project folder to create the{" "}
                    <code className="text-xs">.xcodeproj</code>.
                  </li>
                  <li>
                    Open in Xcode 16+, set your Apple Developer Team in Signing &amp; Capabilities,
                    and Run.
                  </li>
                  <li>Archive → Distribute App → App Store Connect when ready to ship.</li>
                </ol>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── File tree helpers ────────────────────────────────────────────────────
type TreeNode = {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
};

function buildTree(files: GeneratedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isFile: false, children: [] };
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isFile,
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    });
  }
  // sort: folders first, then alpha
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

function FileTreeView({
  node,
  selected,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selected: string | null;
  onSelect: (p: string) => void;
  depth?: number;
}) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "space-y-0.5"}>
      {node.children.map((child) =>
        child.isFile ? (
          <li key={child.path}>
            <button
              onClick={() => onSelect(child.path)}
              className={`w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono transition-colors ${
                selected === child.path
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <FileCode2 size={11} className="shrink-0 opacity-60" />
              <span className="truncate">{child.name}</span>
            </button>
          </li>
        ) : (
          <li key={child.path}>
            <FolderRow name={child.name} depth={depth} />
            <FileTreeView
              node={child}
              selected={selected}
              onSelect={onSelect}
              depth={depth + 1}
            />
          </li>
        ),
      )}
    </ul>
  );
}

function FolderRow({ name, depth }: { name: string; depth: number }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 text-xs text-foreground/80 font-medium"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <ChevronRight size={11} className="opacity-50" />
      <Folder size={11} className="opacity-60" />
      <span className="truncate">{name}</span>
    </div>
  );
}

// ─── ZIP Preview Card ─────────────────────────────────────────────────────
function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function ZipPreviewCard({
  project,
  onSelect,
}: {
  project: Project;
  onSelect: (p: string) => void;
}) {
  const sizes = project.files.map((f) => new Blob([f.content]).size);
  const totalBytes = sizes.reduce((a, b) => a + b, 0);
  const folders = new Set(
    project.files
      .map((f) => f.path.split("/").slice(0, -1).join("/"))
      .filter(Boolean),
  ).size;

  const ranked = [...project.files]
    .map((f, i) => ({ f, size: sizes[i] }))
    .sort((a, b) => {
      const score = (x: { f: GeneratedFile; size: number }) => {
        const n = x.f.path.toLowerCase();
        let s = 0;
        if (/app\.swift$/.test(n)) s += 100;
        if (/contentview\.swift$/.test(n)) s += 80;
        if (/project\.yml$/.test(n)) s += 60;
        if (/readme/i.test(n)) s += 40;
        if (n.endsWith(".swift")) s += 10;
        return s + Math.min(x.size / 200, 20);
      };
      return score(b) - score(a);
    });
  const mainFiles = ranked.slice(0, 4);
  const ext = (p: string) => p.split(".").pop() ?? "";
  const breakdown = project.files.reduce<Record<string, number>>((acc, f) => {
    const e = ext(f.path) || "other";
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium">
            <Eye size={12} /> ZIP Preview
          </div>
          <h3 className="font-display text-lg font-semibold mt-1">
            What's inside{" "}
            <span className="font-mono text-foreground/80">{project.appName}.zip</span>
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div>
            <span className="text-foreground font-semibold">{project.files.length}</span> files
          </div>
          <div>
            <span className="text-foreground font-semibold">{folders}</span> folders
          </div>
          <div>
            <span className="text-foreground font-semibold">{formatBytes(totalBytes)}</span>{" "}
            uncompressed
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {Object.entries(breakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([e, c]) => (
            <span
              key={e}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full bg-card/60 border border-border/40 text-muted-foreground"
            >
              .{e} <span className="text-foreground/80 ml-1">{c}</span>
            </span>
          ))}
      </div>

      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <FileText size={12} /> Main files
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {mainFiles.map(({ f, size }) => {
          const preview = f.content.split("\n").slice(0, 6).join("\n");
          return (
            <button
              key={f.path}
              onClick={() => onSelect(f.path)}
              className="text-left group rounded-lg border border-border/40 bg-card/40 hover:border-primary/50 hover:bg-card/60 transition-colors p-3 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode2 size={12} className="text-primary shrink-0" />
                  <span className="text-xs font-mono truncate text-foreground group-hover:text-primary">
                    {f.path}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {formatBytes(size)}
                </span>
              </div>
              <pre className="text-[10px] font-mono text-muted-foreground/80 leading-snug overflow-hidden whitespace-pre-wrap line-clamp-4">
                {preview}
              </pre>
            </button>
          );
        })}
      </div>
    </div>
  );
}

