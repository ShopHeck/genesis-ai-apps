import { useState, useRef, useEffect, useCallback } from "react";
import { Code2, Eye, Columns2, Maximize2, Minimize2, RotateCw, Copy, Check } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ViewMode = "split" | "editor" | "preview";

export function PreviewPlayground({
  html,
  appName,
  onHtmlChange,
}: {
  html: string;
  appName: string;
  onHtmlChange?: (html: string) => void;
}) {
  const [code, setCode] = useState(html);
  const [liveHtml, setLiveHtml] = useState(html);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setCode(html);
    setLiveHtml(html);
  }, [html]);

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (!value) return;
      setCode(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setLiveHtml(value);
        onHtmlChange?.(value);
      }, 600);
    },
    [onHtmlChange],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleReset = () => {
    setCode(html);
    setLiveHtml(html);
    onHtmlChange?.(html);
    toast.success("Reset to original");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  const viewModes: { id: ViewMode; icon: typeof Code2; label: string }[] = [
    { id: "split", icon: Columns2, label: "Split" },
    { id: "editor", icon: Code2, label: "Code" },
    { id: "preview", icon: Eye, label: "Preview" },
  ];

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : "glass-panel overflow-hidden flex flex-col";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-card/40 shrink-0">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-primary" />
          <span className="text-xs font-medium text-foreground">
            Preview Playground
          </span>
          <span className="text-[10px] text-muted-foreground">
            — edit HTML and see live changes
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-card/60 rounded-md p-0.5 border border-border/40">
            {viewModes.map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all ${
                    viewMode === v.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={11} />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copy HTML"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleReset}
            title="Reset to original"
          >
            <RotateCw size={13} />
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

      <div
        className="flex-1 flex min-h-0"
        style={{ height: fullscreen ? "calc(100vh - 44px)" : 520 }}
      >
        {(viewMode === "split" || viewMode === "editor") && (
          <div
            className={`flex flex-col min-w-0 ${
              viewMode === "split" ? "w-1/2 border-r border-border/40" : "w-full"
            }`}
          >
            <div className="px-3 py-1.5 border-b border-border/40 bg-card/20 flex items-center gap-2">
              <Code2 size={11} className="text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">
                {appName}-preview.html
              </span>
              {code !== html && (
                <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  modified
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <Editor
                height="100%"
                language="html"
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  tabSize: 2,
                  renderWhitespace: "none",
                  folding: true,
                  bracketPairColorization: { enabled: true },
                }}
              />
            </div>
          </div>
        )}

        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`flex flex-col min-w-0 ${
              viewMode === "split" ? "w-1/2" : "w-full"
            }`}
          >
            <div className="px-3 py-1.5 border-b border-border/40 bg-card/20 flex items-center gap-2">
              <Eye size={11} className="text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">
                Live Preview
              </span>
              <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                hot-reload
              </span>
            </div>
            <div className="flex-1 min-h-0 bg-black">
              <iframe
                ref={iframeRef}
                title={`${appName} playground preview`}
                srcDoc={liveHtml}
                sandbox="allow-scripts allow-forms"
                className="w-full h-full border-0"
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>
        )}
      </div>

      {fullscreen && (
        <p className="text-[10px] text-muted-foreground/60 text-center py-1.5 shrink-0">
          Press Esc to exit fullscreen · changes auto-apply after 600ms
        </p>
      )}
    </div>
  );
}
