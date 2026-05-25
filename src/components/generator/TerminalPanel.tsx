import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, TerminalSquare } from "lucide-react";
import type { Stage, LogLine } from "./types";
import { STAGES } from "./stage-config";

interface TerminalPanelProps {
  stage: Stage;
  target: "ios" | "web";
  elapsed: number;
  logs: LogLine[];
  terminalRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
}

export function TerminalPanel({ stage, target, elapsed, logs, terminalRef, loading }: TerminalPanelProps) {
  return (
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
                {(() => { const s = STAGES.find((s) => s.id === stage); return (target === "web" && s?.webLabel) ? s.webLabel : s?.label ?? "Working…"; })()}
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
                      {target === "web" && step.webLabel ? step.webLabel : step.label}
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">{target === "web" && step.webHint ? step.webHint : step.hint}</p>
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
  );
}
