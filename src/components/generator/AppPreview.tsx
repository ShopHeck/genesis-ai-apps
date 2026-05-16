import { useState, useRef, useEffect, useCallback } from "react";
import {
  Smartphone,
  Tablet,
  Monitor,
  RefreshCw,
  Loader2,
  AlertTriangle,
  PlayCircle,
  RotateCw,
  Maximize2,
  Minimize2,
  RotateCcw,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type DeviceMode = "mobile" | "tablet" | "desktop";
type Orientation = "portrait" | "landscape";

const DEVICE_CONFIG: Record<DeviceMode, {
  label: string;
  icon: typeof Smartphone;
  iframeW: number;
  iframeH: number;
  frameClass: string;
  frameRadius: string;
  notch: boolean;
  hint: string;
  supportsRotation: boolean;
}> = {
  mobile: {
    label: "Mobile",
    icon: Smartphone,
    iframeW: 390,
    iframeH: 844,
    frameClass: "rounded-[44px] p-[10px]",
    frameRadius: "36px",
    notch: true,
    hint: "iPhone 15 · 390×844",
    supportsRotation: true,
  },
  tablet: {
    label: "Tablet",
    icon: Tablet,
    iframeW: 820,
    iframeH: 1180,
    frameClass: "rounded-[24px] p-[12px]",
    frameRadius: "16px",
    notch: false,
    hint: "iPad · 820×1180",
    supportsRotation: true,
  },
  desktop: {
    label: "Desktop",
    icon: Monitor,
    iframeW: 1280,
    iframeH: 800,
    frameClass: "rounded-[12px] p-[8px]",
    frameRadius: "4px",
    notch: false,
    hint: "Desktop · 1280×800",
    supportsRotation: false,
  },
};

const PREVIEW_PANEL_MAX_W = 820;
const PREVIEW_PANEL_MAX_H = 640;
const FULLSCREEN_PADDING = 48;

export function AppPreview({
  html,
  loading,
  error,
  onRegenerate,
  appName,
}: {
  html: string | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
  appName: string;
}) {
  const [device, setDevice] = useState<DeviceMode>("mobile");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [fullscreen, setFullscreen] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const cfg = DEVICE_CONFIG[device];

  const effectiveW = orientation === "landscape" && cfg.supportsRotation ? cfg.iframeH : cfg.iframeW;
  const effectiveH = orientation === "landscape" && cfg.supportsRotation ? cfg.iframeW : cfg.iframeH;

  const maxW = fullscreen ? window.innerWidth - FULLSCREEN_PADDING * 2 : PREVIEW_PANEL_MAX_W;
  const maxH = fullscreen ? window.innerHeight - FULLSCREEN_PADDING * 2 - 80 : PREVIEW_PANEL_MAX_H;

  const scaleW = maxW / effectiveW;
  const scaleH = maxH / effectiveH;
  const scale = Math.min(scaleW, scaleH, 1);

  const visW = Math.round(effectiveW * scale);
  const visH = Math.round(effectiveH * scale);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "preview-runtime-error") {
        setRuntimeError(e.data.message ?? "Runtime error in preview");
      }
      if (e.data?.type === "preview-ready") {
        setRuntimeError(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    setRuntimeError(null);
  }, [html]);

  useEffect(() => {
    if (orientation === "landscape" && !cfg.supportsRotation) {
      setOrientation("portrait");
    }
  }, [device, cfg.supportsRotation, orientation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  const handleDownloadPreview = useCallback(() => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${appName}-preview.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Preview HTML downloaded");
  }, [html, appName]);

  const toggleOrientation = () => {
    setOrientation((prev) => (prev === "portrait" ? "landscape" : "portrait"));
  };

  const notchElement = cfg.notch ? (
    orientation === "portrait" ? (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-10 pointer-events-none" />
    ) : (
      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-28 bg-black rounded-full z-10 pointer-events-none" />
    )
  ) : null;

  const hintText = orientation === "landscape" && cfg.supportsRotation
    ? `${cfg.hint.split("·")[0]}· ${effectiveW}×${effectiveH} (landscape)`
    : cfg.hint;

  return (
    <>
    <div ref={containerRef} className={fullscreen ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col overflow-auto p-12" : "glass-panel p-6"}>
      {fullscreen && <div className="max-w-7xl mx-auto w-full" />}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium">
            <Smartphone size={12} /> Interactive Preview
          </div>
          <h3 className="font-display text-lg font-semibold mt-1">
            Try {appName} in your browser
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            An interactive prototype built from your app's design spec — click through
            screens, fill forms, and feel the navigation before opening Xcode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {html && (
            <Button
              onClick={handleDownloadPreview}
              variant="outline"
              size="sm"
              className="border-border/60"
              title="Download preview as HTML"
            >
              <Camera size={14} />
              <span className="hidden sm:inline ml-1">Save</span>
            </Button>
          )}
          <Button
            onClick={() => setFullscreen(!fullscreen)}
            variant="outline"
            size="sm"
            className="border-border/60"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen preview"}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
          <Button
            onClick={onRegenerate}
            disabled={loading}
            variant="outline"
            size="sm"
            className="border-border/60"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Generating…
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                {html ? "Regenerate" : "Generate preview"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 justify-center flex-wrap">
        <div className="flex items-center gap-1 bg-card/40 rounded-lg p-1 border border-border/40">
          {(Object.keys(DEVICE_CONFIG) as DeviceMode[]).map((d) => {
            const dc = DEVICE_CONFIG[d];
            const Icon = dc.icon;
            return (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  device === d
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{dc.label}</span>
              </button>
            );
          })}
        </div>

        {cfg.supportsRotation && (
          <button
            onClick={toggleOrientation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-border/40 ${
              orientation === "landscape"
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground hover:text-foreground bg-card/40"
            }`}
            title={`Switch to ${orientation === "portrait" ? "landscape" : "portrait"}`}
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">
              {orientation === "portrait" ? "Landscape" : "Portrait"}
            </span>
          </button>
        )}
      </div>

      <div className="flex justify-center">
        <div style={{ width: visW, height: visH }} className="relative">
          <div
            className={`absolute inset-0 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] ${cfg.frameClass}`}
            style={{
              background: "linear-gradient(145deg, hsl(var(--border)) 0%, hsl(var(--card)) 100%)",
            }}
          >
            <div
              className="relative w-full h-full overflow-hidden bg-black"
              style={{ borderRadius: cfg.frameRadius }}
            >
              {notchElement}

              <div
                style={{
                  width: effectiveW,
                  height: effectiveH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  pointerEvents: "auto",
                }}
              >
                {loading && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 text-muted-foreground bg-[hsl(228_20%_4%)]"
                    style={{ width: effectiveW, height: effectiveH }}
                  >
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="text-sm font-mono">building interactive preview…</p>
                    <p className="text-xs text-muted-foreground/60 max-w-[260px] text-center">
                      Rendering screens, navigation, and seed data from your design spec
                    </p>
                  </div>
                )}

                {!loading && error && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-[hsl(228_20%_4%)]"
                    style={{ width: effectiveW, height: effectiveH }}
                  >
                    <AlertTriangle className="text-destructive" size={28} />
                    <p className="text-sm text-foreground font-medium">Preview failed</p>
                    <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
                    <Button onClick={onRegenerate} size="sm" variant="outline" className="mt-2">
                      <RefreshCw size={12} /> Retry
                    </Button>
                  </div>
                )}

                {!loading && !error && !html && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-[hsl(228_20%_4%)]"
                    style={{ width: effectiveW, height: effectiveH }}
                  >
                    <PlayCircle className="text-primary" size={40} />
                    <p className="text-sm text-foreground font-medium">Interactive preview</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Click to generate a responsive prototype from your design spec
                    </p>
                    <Button onClick={onRegenerate} size="sm" className="mt-2">
                      <Smartphone size={12} /> Generate preview
                    </Button>
                  </div>
                )}

                {!loading && html && (
                  <iframe
                    ref={iframeRef}
                    title={`${appName} preview`}
                    srcDoc={html}
                    sandbox="allow-scripts allow-forms"
                    className="border-0 bg-black"
                    style={{ width: effectiveW, height: effectiveH, colorScheme: "dark", display: "block" }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {runtimeError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={14} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground">Preview runtime error</p>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{runtimeError}</p>
          </div>
          <button
            onClick={onRegenerate}
            className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
          >
            <RotateCw size={11} /> Fix with AI
          </button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
        {hintText} · sandboxed iframe · responsive layout · {scale < 1 ? `scaled ${Math.round(scale * 100)}% to fit` : "1:1"}
        {fullscreen && " · press Esc to exit"}
      </p>
    </div>
    </>
  );
}
