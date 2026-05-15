import { Check, ShieldCheck, ShieldAlert, XCircle } from "lucide-react";
import type { Project } from "./types";

type ValidationIssue = {
  level: "error" | "warning" | "info";
  message: string;
  hint?: string;
  file?: string;
};

export type ValidationResult = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  passed: string[];
};

export function validateProject(project: Project): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const infos: ValidationIssue[] = [];
  const passed: string[] = [];

  const has = (re: RegExp) => project.files.find((f) => re.test(f.path));

  // 1. project.yml
  const projectYml = has(/(^|\/)project\.yml$/i);
  if (!projectYml) {
    errors.push({
      level: "error",
      message: "Missing project.yml",
      hint: "XcodeGen requires a project.yml at the project root to generate the .xcodeproj.",
    });
  } else {
    passed.push("project.yml present");
    const yml = projectYml.content;
    const checks: { key: RegExp; label: string; level: "error" | "warning" }[] = [
      { key: /^name:\s*\S+/m, label: "name", level: "error" },
      { key: /^options:/m, label: "options block", level: "warning" },
      { key: /bundleIdPrefix|PRODUCT_BUNDLE_IDENTIFIER/, label: "bundle identifier", level: "warning" },
      { key: /^targets:/m, label: "targets block", level: "error" },
      { key: /deploymentTarget|IPHONEOS_DEPLOYMENT_TARGET/, label: "deploymentTarget", level: "warning" },
    ];
    for (const c of checks) {
      if (!c.key.test(yml)) {
        (c.level === "error" ? errors : warnings).push({
          level: c.level,
          message: `project.yml missing \`${c.label}\``,
          file: projectYml.path,
          hint: "XcodeGen will fail or produce an invalid project without it.",
        });
      } else {
        passed.push(`project.yml: ${c.label}`);
      }
    }
  }

  // 2. App entry point
  const appEntry = project.files.find(
    (f) => f.path.endsWith(".swift") && /@main\s+struct\s+\w+\s*:\s*App\b/.test(f.content),
  );
  if (!appEntry) {
    errors.push({
      level: "error",
      message: "No SwiftUI App entry point found",
      hint: "Expected a `@main struct XxxApp: App` declaration in a .swift file.",
    });
  } else {
    passed.push(`App entry: ${appEntry.path}`);
  }

  // 3. SwiftUI View
  const rootView = project.files.some(
    (f) => f.path.endsWith(".swift") && /struct\s+\w+\s*:\s*View\b/.test(f.content),
  );
  if (!rootView) {
    warnings.push({
      level: "warning",
      message: "No SwiftUI View found",
      hint: "App should contain at least one `struct X: View` for the UI.",
    });
  } else {
    passed.push("SwiftUI View(s) present");
  }

  // 4. Assets
  const hasAssets = has(/Assets\.xcassets\//i) || has(/Assets\.xcassets$/i);
  if (!hasAssets) {
    warnings.push({
      level: "warning",
      message: "No Assets.xcassets catalog",
      hint: "App icon and accent color won't be configurable without an asset catalog.",
    });
  } else {
    passed.push("Assets.xcassets catalog");
  }

  const hasAppIcon = project.files.some((f) => /AppIcon\.appiconset/i.test(f.path));
  if (!hasAppIcon) {
    warnings.push({
      level: "warning",
      message: "No AppIcon.appiconset",
      hint: "App Store submission requires an app icon set.",
    });
  } else {
    passed.push("AppIcon.appiconset");
  }

  // 5. Info.plist
  const hasInfoPlist = has(/Info\.plist$/);
  const ymlGenerates = projectYml && /(^|\s)info:/m.test(projectYml.content);
  if (!hasInfoPlist && !ymlGenerates) {
    infos.push({
      level: "info",
      message: "No Info.plist file",
      hint: "OK if XcodeGen generates one via the `info:` key, otherwise add one.",
    });
  } else {
    passed.push("Info.plist (file or generated)");
  }

  // 6. Bundle ID
  if (project.bundleId && !/^[a-zA-Z0-9.-]+$/.test(project.bundleId)) {
    errors.push({
      level: "error",
      message: `Invalid bundle identifier: ${project.bundleId}`,
      hint: "Use reverse-DNS format, e.g. com.acme.AppName.",
    });
  } else if (project.bundleId) {
    passed.push("Bundle ID format");
  }

  // 7. Empty files
  for (const f of project.files) {
    if (f.content.trim().length === 0) {
      warnings.push({
        level: "warning",
        message: `Empty file: ${f.path}`,
        file: f.path,
      });
    }
  }

  // 8. README
  if (!has(/^README(\.md)?$/i)) {
    infos.push({ level: "info", message: "No README — build instructions are provided in the UI." });
  } else {
    passed.push("README present");
  }

  return { errors, warnings, infos, passed };
}

export function ValidationPanel({
  result,
  onSelect,
}: {
  result: ValidationResult;
  onSelect: (p: string) => void;
}) {
  const ok = result.errors.length === 0 && result.warnings.length === 0;
  const Icon = result.errors.length > 0 ? XCircle : ok ? ShieldCheck : ShieldAlert;
  const tone =
    result.errors.length > 0
      ? "border-destructive/50 bg-destructive/5"
      : ok
        ? "border-primary/40 bg-primary/5"
        : "border-amber-500/40 bg-amber-500/5";
  const iconTone =
    result.errors.length > 0
      ? "text-destructive"
      : ok
        ? "text-primary"
        : "text-amber-400";

  return (
    <div className={`glass-panel border ${tone} p-6`}>
      <div className="flex items-start gap-3 mb-4">
        <Icon className={`shrink-0 ${iconTone}`} size={22} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            Pre-download validation
          </div>
          <h3 className="font-display text-lg font-semibold mt-0.5">
            {result.errors.length > 0
              ? `${result.errors.length} blocking issue${result.errors.length > 1 ? "s" : ""} — fix before download`
              : ok
                ? "All XcodeGen checks passed"
                : `${result.warnings.length} warning${result.warnings.length > 1 ? "s" : ""} — safe to download`}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {result.passed.length} checks passed · {result.warnings.length} warnings ·{" "}
            {result.errors.length} errors
          </p>
        </div>
      </div>

      {[
        { key: "errors" as const, items: result.errors, label: "Errors", color: "text-destructive", dot: "bg-destructive" },
        { key: "warnings" as const, items: result.warnings, label: "Warnings", color: "text-amber-400", dot: "bg-amber-400" },
        { key: "infos" as const, items: result.infos, label: "Notes", color: "text-muted-foreground", dot: "bg-muted-foreground" },
      ]
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.key} className="mt-3">
            <p className={`text-[11px] uppercase tracking-wider font-medium mb-1.5 ${g.color}`}>
              {g.label} ({g.items.length})
            </p>
            <ul className="space-y-1.5">
              {g.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm rounded-md p-2 bg-card/40 border border-border/30"
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${g.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{it.message}</p>
                    {it.hint && (
                      <p className="text-xs text-muted-foreground mt-0.5">{it.hint}</p>
                    )}
                    {it.file && (
                      <button
                        onClick={() => onSelect(it.file!)}
                        className="text-xs font-mono text-primary hover:underline mt-0.5"
                      >
                        {it.file}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

      {result.passed.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Check size={12} /> {result.passed.length} checks passed
          </summary>
          <ul className="mt-2 grid sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
            {result.passed.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check size={11} className="text-primary/70 shrink-0" />
                <span className="truncate">{p}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
