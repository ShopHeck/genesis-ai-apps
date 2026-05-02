import { useState } from "react";
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

export default function Generator() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (prompt.trim().length < 10) {
      toast.error("Describe your app in a bit more detail.");
      return;
    }
    setLoading(true);
    setError(null);
    setProject(null);
    setSelectedFile(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-ios-app", {
        body: { prompt },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.files?.length) throw new Error("Empty project returned.");

      setProject(data as Project);
      setSelectedFile(data.files[0].path);
      toast.success(`${data.appName} generated — ${data.files.length} files`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!project) return;
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

        {/* Loading skeleton */}
        {loading && (
          <div className="glass-panel p-8 text-center">
            <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={28} />
            <p className="text-sm text-muted-foreground">
              Designing architecture, writing SwiftUI views, wiring SwiftData models…
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              This usually takes 20–60 seconds.
            </p>
          </div>
        )}

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
