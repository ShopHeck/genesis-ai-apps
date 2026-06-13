import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { ComplianceReport, ComplianceCheck } from "./types";

function scoreColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function CheckRow({ check }: { check: ComplianceCheck }) {
  const Icon = check.passed
    ? CheckCircle2
    : check.severity === "error"
      ? XCircle
      : check.severity === "warning"
        ? AlertTriangle
        : Info;
  const color = check.passed
    ? "text-emerald-400"
    : check.severity === "error"
      ? "text-red-400"
      : check.severity === "warning"
        ? "text-yellow-400"
        : "text-muted-foreground";
  return (
    <li className="flex items-start gap-2.5 py-2 border-b border-border/30 last:border-0">
      <Icon size={15} className={`shrink-0 mt-0.5 ${color}`} />
      <div className="min-w-0">
        <p className="text-sm text-foreground">{check.label}</p>
        {!check.passed && check.detail && (
          <p className="text-xs text-muted-foreground mt-0.5">{check.detail}</p>
        )}
      </div>
      {!check.passed && (
        <span className={`ml-auto shrink-0 text-[10px] uppercase tracking-wide ${color}`}>
          {check.severity}
        </span>
      )}
    </li>
  );
}

export function CompliancePanel({ report }: { report: ComplianceReport }) {
  const failed = report.checks.filter((c) => !c.passed);
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ShieldCheck size={16} className="text-primary" />
          Built for Shopify compliance
        </div>
        <div className="text-right">
          <span className={`font-display text-2xl font-bold ${scoreColor(report.score)}`}>
            {report.score}
          </span>
          <span className="text-muted-foreground text-sm">/100</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {report.passed
          ? failed.length === 0
            ? "All checks passed — this app meets the deterministic Built-for-Shopify gates."
            : `No blocking errors. ${failed.length} recommendation(s) to polish before submission.`
          : "Blocking issues found — fix the errors below before submitting to the App Store."}
        {" "}See <code className="text-foreground/80">STORE_LISTING.md</code> in the project for the full submission checklist.
      </p>

      <ul>
        {report.checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ul>
    </div>
  );
}
