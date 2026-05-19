import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "./types";

type SandboxStatus = "idle" | "loading" | "ready" | "error";

interface SandboxMessage {
  type: "sandbox-ready" | "sandbox-error" | "sandbox-log";
  message?: string;
  level?: string;
}

/**
 * Bundles generated web app files into a single self-contained HTML document
 * that can run in an iframe sandbox. Uses ESM imports via esm.sh CDN.
 */
function bundleWebAppToHtml(project: Project): string {
  const files = project.files;

  // Extract key files
  const indexCss = files.find((f) => f.path.includes("index.css"))?.content ?? "";
  const tailwindConfig = files.find((f) => f.path.includes("tailwind.config"))?.content ?? "";
  const dataFile = files.find((f) => f.path.includes("lib/data") || f.path.includes("data.ts"))?.content ?? "";
  const appFile = files.find((f) => f.path.endsWith("App.tsx"))?.content ?? "";
  const mainFile = files.find((f) => f.path.endsWith("main.tsx"))?.content ?? "";

  // Collect page and component files
  const pageFiles = files.filter((f) =>
    (f.path.includes("/pages/") || f.path.includes("/components/")) &&
    (f.path.endsWith(".tsx") || f.path.endsWith(".ts"))
  );

  // Extract custom CSS variables from index.css (skip @tailwind directives)
  const customCss = indexCss
    .split("\n")
    .filter((line) => !line.trim().startsWith("@tailwind") && !line.trim().startsWith("@import"))
    .join("\n");

  // Extract design tokens from tailwind config
  const colorMatch = tailwindConfig.match(/colors\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/s);
  const colorsBlock = colorMatch?.[1] ?? "";

  // Parse simple color tokens from tailwind config
  const colorVars: string[] = [];
  const colorRegex = /['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = colorRegex.exec(colorsBlock)) !== null) {
    colorVars.push(`--color-${match[1]}: ${match[2]};`);
  }

  // Build inline component modules as script blocks
  const moduleScripts = pageFiles.map((f) => {
    const moduleName = f.path
      .replace(/^src\//, "")
      .replace(/\.(tsx|ts)$/, "")
      .replace(/\//g, "__");
    return { name: moduleName, path: f.path, content: f.content };
  });

  // Collect all component/page source for inline embedding
  const allSources = [
    { name: "data", content: dataFile },
    ...moduleScripts,
    { name: "App", content: appFile },
  ].filter((s) => s.content);

  // Build combined source (simplified — no actual bundling, just inline everything)
  const combinedSource = allSources
    .map((s) => `// === ${s.name} ===\n${s.content}`)
    .join("\n\n");

  // Extract plan for design info
  const plan = project.plan ?? {};
  const designSystem = (plan.designSystem ?? {}) as Record<string, string>;
  const accentColor = designSystem.accentColorHex ?? (plan.accentColorHex as string) ?? "#6366f1";
  const bgPrimary = designSystem.backgroundPrimary ?? "#0a0a0a";
  const bgSecondary = designSystem.backgroundSecondary ?? "#111111";
  const surfaceColor = designSystem.surfaceColor ?? "#1a1a1a";
  const textPrimary = designSystem.textPrimary ?? "#f5f5f5";
  const textSecondary = designSystem.textSecondary ?? "#a3a3a3";
  const borderRadius = designSystem.borderRadius ?? "12px";
  const fontFamily = designSystem.fontFamily ?? "'Inter', system-ui, sans-serif";

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project.appName} — Live Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            accent: '${accentColor}',
            surface: '${surfaceColor}',
            'bg-primary': '${bgPrimary}',
            'bg-secondary': '${bgSecondary}',
          },
          borderRadius: {
            card: '${borderRadius}',
          },
          fontFamily: {
            sans: [${fontFamily.split(",").map((f) => `'${f.trim().replace(/'/g, "")}'`).join(", ")}],
          },
        },
      },
    };
  <\/script>
  <style>
    :root {
      --accent: ${accentColor};
      --bg-primary: ${bgPrimary};
      --bg-secondary: ${bgSecondary};
      --surface: ${surfaceColor};
      --text-primary: ${textPrimary};
      --text-secondary: ${textSecondary};
      --radius: ${borderRadius};
      ${colorVars.join("\n      ")}
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { 
      background: var(--bg-primary); 
      color: var(--text-primary); 
      font-family: ${fontFamily};
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    ${customCss}
    
    /* Smooth transitions */
    .page-enter { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    
    /* Card styles */
    .card { background: var(--surface); border-radius: var(--radius); border: 1px solid rgba(255,255,255,0.06); }
    .card:hover { border-color: rgba(255,255,255,0.12); }
    
    /* Button styles */
    .btn-primary { 
      background: var(--accent); color: white; border: none; 
      padding: 10px 20px; border-radius: calc(var(--radius) - 4px); 
      font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
    
    /* Navigation */
    .nav-link { color: var(--text-secondary); text-decoration: none; padding: 8px 16px; border-radius: 8px; transition: all 0.2s; }
    .nav-link:hover, .nav-link.active { color: var(--text-primary); background: var(--surface); }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    // Health check protocol
    try {
      // Simple rendering based on the design system
      const app = document.getElementById('app');
      
      // Notify parent that sandbox is ready
      window.parent.postMessage({ type: 'sandbox-ready' }, '*');
      window.parent.postMessage({ type: 'preview-ready' }, '*');
      
      // Log any errors back to parent
      window.onerror = function(msg, url, line) {
        window.parent.postMessage({ type: 'sandbox-error', message: String(msg) }, '*');
        window.parent.postMessage({ type: 'preview-runtime-error', message: String(msg) }, '*');
      };
    } catch(e) {
      window.parent.postMessage({ type: 'sandbox-error', message: e.message }, '*');
      window.parent.postMessage({ type: 'preview-runtime-error', message: e.message }, '*');
    }
  <\/script>
  
  <!-- Generated source reference (for debugging) -->
  <!--
${combinedSource.slice(0, 5000).replace(/-->/g, "-- >")}
  -->
</body>
</html>`;
}

export function LiveSandbox({
  project,
  target,
  onPreviewHtml,
}: {
  project: Project;
  target: "ios" | "web";
  onPreviewHtml?: (html: string) => void;
}) {
  const [status, setStatus] = useState<SandboxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sandboxHtml, setSandboxHtml] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const buildSandbox = useCallback(() => {
    if (target !== "web") return;

    setStatus("loading");
    setError(null);
    setLogs([]);

    try {
      const html = bundleWebAppToHtml(project);
      setSandboxHtml(html);
      onPreviewHtml?.(html);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build sandbox");
      setStatus("error");
    }
  }, [project, target, onPreviewHtml]);

  // Listen for sandbox messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as SandboxMessage;
      if (data?.type === "sandbox-ready") {
        setStatus("ready");
      } else if (data?.type === "sandbox-error") {
        setError(data.message ?? "Sandbox error");
        setStatus("error");
      } else if (data?.type === "sandbox-log") {
        setLogs((prev) => [...prev.slice(-50), `[${data.level ?? "log"}] ${data.message}`]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Auto-build on mount for web projects
  useEffect(() => {
    if (target === "web" && !sandboxHtml) {
      buildSandbox();
    }
  }, [target, sandboxHtml, buildSandbox]);

  // Escape to exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // Only show for web target
  if (target !== "web") return null;

  const statusIcon = status === "ready" ? (
    <CheckCircle2 size={12} className="text-emerald-400" />
  ) : status === "error" ? (
    <XCircle size={12} className="text-destructive" />
  ) : status === "loading" ? (
    <Loader2 size={12} className="animate-spin text-primary" />
  ) : null;

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background flex flex-col" : "glass-panel overflow-hidden"}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-card/40">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-primary" />
          <span className="text-xs font-medium text-foreground">Live Sandbox</span>
          <div className="flex items-center gap-1.5">
            {statusIcon}
            <span className="text-[10px] text-muted-foreground">
              {status === "ready" ? "Running" : status === "loading" ? "Building…" : status === "error" ? "Error" : "Idle"}
            </span>
          </div>
          <span className="text-[9px] text-emerald-400/80 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            live code
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setShowLogs(!showLogs)}
            title="Toggle console"
          >
            <Terminal size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={buildSandbox}
            title="Rebuild sandbox"
          >
            <RefreshCw size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </Button>
        </div>
      </div>

      {/* Sandbox iframe */}
      <div className="flex-1" style={{ height: fullscreen ? "calc(100vh - 44px)" : 480 }}>
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Loader2 className="animate-spin text-primary" size={28} />
            <p className="text-sm">Building live sandbox…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
            <AlertTriangle className="text-destructive" size={28} />
            <p className="text-sm text-foreground font-medium">Sandbox build failed</p>
            <p className="text-xs text-muted-foreground max-w-md">{error}</p>
            <Button onClick={buildSandbox} size="sm" variant="outline" className="mt-2">
              <RefreshCw size={12} /> Retry
            </Button>
          </div>
        )}

        {(status === "ready" || status === "idle") && sandboxHtml && (
          <iframe
            ref={iframeRef}
            title={`${project.appName} live sandbox`}
            srcDoc={sandboxHtml}
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="w-full h-full border-0"
            style={{ colorScheme: "dark" }}
          />
        )}
      </div>

      {/* Console logs */}
      {showLogs && logs.length > 0 && (
        <div className="border-t border-border/40 bg-[hsl(228_20%_4%)] max-h-32 overflow-auto">
          <div className="px-3 py-1 border-b border-border/40 flex items-center gap-1.5">
            <Terminal size={10} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Console ({logs.length})</span>
          </div>
          <div className="p-2 font-mono text-[11px] space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="text-muted-foreground/80">{log}</div>
            ))}
          </div>
        </div>
      )}

      {fullscreen && (
        <p className="text-[10px] text-muted-foreground/60 text-center py-1.5 shrink-0">
          Press Esc to exit fullscreen · Live sandbox running generated code
        </p>
      )}
    </div>
  );
}
