import { useEffect, useRef, useState } from "react";
import {
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  AlertTriangle,
  RefreshCw,
  PlayCircle,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type DeviceMode = "mobile" | "tablet" | "desktop";

const DEVICE_CONFIG: Record<DeviceMode, {
  label: string;
  icon: typeof Smartphone;
  iframeW: number;
  iframeH: number;
  frameClass: string;
  frameRadius: string;
  notch: boolean;
  hint: string;
}> = {
  mobile: {
    label: "Mobile",
    icon: Smartphone,
    iframeW: 390,
    iframeH: 844,
    frameClass: "rounded-[44px] p-[10px]",
    frameRadius: "36px",
    notch: true,
    hint: "iPhone 15 \u00b7 390\u00d7844",
  },
  tablet: {
    label: "Tablet",
    icon: Tablet,
    iframeW: 820,
    iframeH: 1180,
    frameClass: "rounded-[24px] p-[12px]",
    frameRadius: "16px",
    notch: false,
    hint: "iPad \u00b7 820\u00d71180",
  },
  desktop: {
    label: "Desktop",
    icon: Monitor,
    iframeW: 1280,
    iframeH: 800,
    frameClass: "rounded-[12px] p-[8px]",
    frameRadius: "4px",
    notch: false,
    hint: "Desktop \u00b7 1280\u00d7800",
  },
};

const PREVIEW_PANEL_MAX_W = 820;
const PREVIEW_PANEL_MAX_H = 640;

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
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const cfg = DEVICE_CONFIG[device];

  const scaleW = PREVIEW_PANEL_MAX_W / cfg.iframeW;
  const scaleH = PREVIEW_PANEL_MAX_H / cfg.iframeH;
  const scale = Math.min(scaleW, scaleH, 1);

  const visW = Math.round(cfg.iframeW * scale);
  const visH = Math.round(cfg.iframeH * scale);

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

  return (
    <div className="glass-panel p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary font-medium">
            <Smartphone size={12} /> Interactive Preview
          </div>
          <h3 className="font-display text-lg font-semibold mt-1">
            Try {appName} in your browser
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            An interactive prototype built from your app's design spec \u2014 click through
            screens, fill forms, and feel the navigation before opening Xcode.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                Generating...
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

      {/* Device switcher */}
      <div className="flex items-center gap-1 mb-5 bg-card/40 rounded-lg p-1 w-fit mx-auto border border-border/40">
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

      {/* Preview stage */}
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
              {cfg.notch && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-10 pointer-events-none" />
              )}

              <div
                style={{
                  width: cfg.iframeW,
                  height: cfg.iframeH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  pointerEvents: "auto",
                }}
              >
                {loading && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 text-muted-foreground bg-[hsl(228_20%_4%)]"
                    style={{ width: cfg.iframeW, height: cfg.iframeH }}
                  >
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <p className="text-sm font-mono">building interactive preview...</p>
                    <p className="text-xs text-muted-foreground/60 max-w-[260px] text-center">
                      Rendering screens, navigation, and seed data from your design spec
                    </p>
                  </div>
                )}

                {!loading && error && (
                  <div
                    className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-[hsl(228_20%_4%)]"
                    style={{ width: cfg.iframeW, height: cfg.iframeH }}
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
                    style={{ width: cfg.iframeW, height: cfg.iframeH }}
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
                    style={{ width: cfg.iframeW, height: cfg.iframeH, colorScheme: "dark", display: "block" }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Runtime error banner */}
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
        {cfg.hint} \u00b7 sandboxed iframe \u00b7 responsive layout \u00b7 {scale < 1 ? `scaled ${Math.round(scale * 100)}% to fit` : "1:1"}
      </p>
    </div>
  );
}
