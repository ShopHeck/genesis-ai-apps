import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Palette,
  Layers,
  Move3D,
  FileText,
  LayoutGrid,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "./types";

interface QualityDimensions {
  visualIdentity: number;
  componentRichness: number;
  animationMotion: number;
  contentQuality: number;
  layoutHierarchy: number;
  overallPolish: number;
}

interface QualityImprovement {
  file: string;
  issue: string;
  fix: string;
  impact: string;
}

interface QualityReport {
  overallScore: number;
  dimensions: QualityDimensions;
  verdict: string;
  strengths: string[];
  improvements: QualityImprovement[];
  summary: string;
}

const DIMENSION_META: { key: keyof QualityDimensions; label: string; icon: typeof Palette }[] = [
  { key: "visualIdentity", label: "Visual Identity", icon: Palette },
  { key: "componentRichness", label: "Components", icon: Layers },
  { key: "animationMotion", label: "Animation", icon: Move3D },
  { key: "contentQuality", label: "Content", icon: FileText },
  { key: "layoutHierarchy", label: "Layout", icon: LayoutGrid },
  { key: "overallPolish", label: "Polish", icon: Star },
];

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-amber-400";
  return "text-destructive";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-400/10 border-emerald-400/30";
  if (score >= 60) return "bg-primary/10 border-primary/30";
  if (score >= 40) return "bg-amber-400/10 border-amber-400/30";
  return "bg-destructive/10 border-destructive/30";
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "studio": return "Studio Quality";
    case "polished": return "Polished";
    case "adequate": return "Adequate";
    case "needs_work": return "Needs Work";
    default: return verdict;
  }
}

export function QualityScore({
  project,
  previewHtml,
}: {
  project: Project;
  previewHtml: string | null;
}) {
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const evaluate = async () => {
    setLoading(true);
    setError(null);
    try {
      const sourceFiles = project.files
        .filter((f) =>
          f.path.endsWith("Theme.swift") ||
          f.path.endsWith("ContentView.swift") ||
          f.path.match(/Features\/.*View\.swift$/) ||
          f.path.match(/Components\/.*\.swift$/) ||
          f.path.match(/Store\.swift$/)
        )
        .slice(0, 10)
        .map((f) => `// === ${f.path} ===\n${f.content.slice(0, 2000)}`)
        .join("\n\n");

      const { data, error: fnErr } = await supabase.functions.invoke("evaluate-quality", {
        body: {
          plan: (project as Record<string, unknown>).plan ?? null,
          sourceFiles: sourceFiles || undefined,
          previewHtml: previewHtml?.slice(0, 8000) || undefined,
        },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.report) throw new Error("No quality report returned");

      setReport(data.report as QualityReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project && !report && !loading && !error) {
      evaluate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  if (loading) {
    return (
      <div className="glass-panel p-4 flex items-center gap-3">
        <Loader2 className="animate-spin text-primary" size={16} />
        <span className="text-sm text-muted-foreground">Evaluating visual quality…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-amber-400" size={14} />
          <span className="text-xs text-muted-foreground">Quality check unavailable</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={evaluate}>
          Retry
        </Button>
      </div>
    );
  }

  if (!report) return null;

  const score = Math.round(report.overallScore);

  return (
    <div className={`glass-panel overflow-hidden border ${scoreBg(score)}`}>
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold font-mono tabular-nums ${scoreColor(score)}`}>
            {score}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className={scoreColor(score)} />
              <span className={`text-xs font-semibold ${scoreColor(score)}`}>
                {verdictLabel(report.verdict)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
              {report.summary}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Mini dimension bars */}
          <div className="hidden sm:flex items-center gap-1">
            {DIMENSION_META.map((d) => {
              const val = report.dimensions[d.key];
              return (
                <div
                  key={d.key}
                  className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                  style={{
                    backgroundColor: val >= 8 ? "rgba(52,211,153,0.15)" : val >= 6 ? "rgba(99,102,241,0.15)" : val >= 4 ? "rgba(251,191,36,0.15)" : "rgba(239,68,68,0.15)",
                    color: val >= 8 ? "#34d399" : val >= 6 ? "#818cf8" : val >= 4 ? "#fbbf24" : "#ef4444",
                  }}
                  title={`${d.label}: ${val}/10`}
                >
                  {val}
                </div>
              );
            })}
          </div>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 p-4 space-y-4">
              {/* Dimension scores */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DIMENSION_META.map((d) => {
                  const val = report.dimensions[d.key];
                  const Icon = d.icon;
                  return (
                    <div key={d.key} className="flex items-center gap-2 rounded-lg bg-card/40 p-2.5">
                      <Icon size={14} className={scoreColor(val * 10)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground">{d.label}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-border/40">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${val * 10}%`,
                                backgroundColor: val >= 8 ? "#34d399" : val >= 6 ? "#818cf8" : val >= 4 ? "#fbbf24" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold tabular-nums" style={{
                            color: val >= 8 ? "#34d399" : val >= 6 ? "#818cf8" : val >= 4 ? "#fbbf24" : "#ef4444",
                          }}>
                            {val}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Strengths */}
              {report.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-400 mb-1.5 flex items-center gap-1">
                    <Zap size={11} /> Strengths
                  </p>
                  <ul className="space-y-1">
                    {report.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5 shrink-0">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {report.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-400 mb-1.5 flex items-center gap-1">
                    <AlertTriangle size={11} /> Suggested Improvements
                  </p>
                  <div className="space-y-2">
                    {report.improvements.map((imp, i) => (
                      <div key={i} className="rounded-lg bg-card/40 p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            imp.impact === "high" ? "bg-destructive/15 text-destructive" :
                            imp.impact === "medium" ? "bg-amber-400/15 text-amber-400" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {imp.impact}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground truncate">{imp.file}</span>
                        </div>
                        <p className="text-xs text-foreground/90">{imp.issue}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{imp.fix}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-evaluate button */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={evaluate}
                  disabled={loading}
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  <span className="ml-1">Re-evaluate</span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
