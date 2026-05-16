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

  // 9. Swift 6 strict concurrency checks
  const swiftFiles = project.files.filter((f) => f.path.endsWith(".swift"));
  const usesObservableObject = swiftFiles.some((f) => /\bObservableObject\b/.test(f.content));
  const usesObservable = swiftFiles.some((f) => /@Observable\b/.test(f.content));
  if (usesObservableObject && !usesObservable) {
    warnings.push({
      level: "warning",
      message: "Uses ObservableObject instead of @Observable",
      hint: "Swift 6 / iOS 17+ apps should prefer @Observable (Observation framework) over the older ObservableObject protocol.",
    });
  } else if (usesObservable) {
    passed.push("@Observable pattern (Swift 6)");
  }

  // 10. NavigationStack vs NavigationView
  const usesNavigationView = swiftFiles.some((f) => /\bNavigationView\b/.test(f.content));
  const usesNavigationStack = swiftFiles.some((f) => /\bNavigationStack\b/.test(f.content));
  if (usesNavigationView) {
    warnings.push({
      level: "warning",
      message: "Uses deprecated NavigationView",
      hint: "NavigationView is deprecated in iOS 16+. Use NavigationStack with value-based .navigationDestination(for:) instead.",
    });
  }
  if (usesNavigationStack) {
    passed.push("NavigationStack pattern");
  }

  // 11. SwiftData vs CoreData
  const usesCoreData = swiftFiles.some((f) => /\bimport CoreData\b/.test(f.content));
  const usesSwiftData = swiftFiles.some((f) => /\bimport SwiftData\b/.test(f.content) || /@Model\b/.test(f.content));
  if (usesCoreData) {
    warnings.push({
      level: "warning",
      message: "Uses CoreData instead of SwiftData",
      hint: "Modern iOS 17+ apps should use SwiftData (@Model, @Query) instead of CoreData.",
    });
  }
  if (usesSwiftData) {
    passed.push("SwiftData persistence");
  }

  // 12. Theme.swift completeness
  const themeFile = project.files.find((f) => f.path.endsWith("Theme.swift"));
  if (themeFile) {
    const themeContent = themeFile.content;
    const themeTokens = [
      { re: /accentColor|accent/i, label: "accent color" },
      { re: /spacing|paddingScale/i, label: "spacing scale" },
      { re: /cornerRadius|radius/i, label: "corner radii" },
    ];
    let themeComplete = true;
    for (const t of themeTokens) {
      if (!t.re.test(themeContent)) {
        themeComplete = false;
        warnings.push({
          level: "warning",
          message: `Theme.swift missing ${t.label} token`,
          file: themeFile.path,
          hint: "A complete design system requires all core tokens defined in Theme.swift.",
        });
      }
    }
    if (themeComplete) {
      passed.push("Theme.swift design tokens");
    }
  }

  // 13. Accessibility checks
  const viewFiles = swiftFiles.filter((f) => /struct\s+\w+\s*:\s*View\b/.test(f.content));
  const hasAccessibility = viewFiles.some((f) =>
    /\.accessibilityLabel|accessibilityHint|accessibilityValue/.test(f.content)
  );
  if (viewFiles.length > 0 && !hasAccessibility) {
    infos.push({
      level: "info",
      message: "No accessibility labels detected",
      hint: "Add .accessibilityLabel() and .accessibilityHint() to interactive elements for VoiceOver support.",
    });
  } else if (hasAccessibility) {
    passed.push("Accessibility labels present");
  }

  // 14. Error handling — no fatalError in production paths
  const hasFatalError = swiftFiles.some(
    (f) => /\bfatalError\b/.test(f.content) && !/#Preview/.test(f.content)
  );
  if (hasFatalError) {
    warnings.push({
      level: "warning",
      message: "Contains fatalError() in production code",
      hint: "Use typed Error enums with LocalizedError instead of fatalError() for recoverable errors.",
    });
  } else if (swiftFiles.length > 0) {
    passed.push("No fatalError in production code");
  }

  // 15. Placeholder / stub detection
  const STUB_RE = /\/\/\s*\.\.\.\s*(rest|TODO|truncated|add|implement)/i;
  for (const f of swiftFiles) {
    if (STUB_RE.test(f.content)) {
      warnings.push({
        level: "warning",
        message: `Possible stub/truncation in ${f.path}`,
        file: f.path,
        hint: "File may contain incomplete code marked with truncation comments.",
      });
    }
  }

  // 16. Haptic feedback on primary actions
  const hasSensoryFeedback = swiftFiles.some((f) => /\.sensoryFeedback/.test(f.content));
  if (viewFiles.length > 3 && !hasSensoryFeedback) {
    infos.push({
      level: "info",
      message: "No haptic feedback detected",
      hint: "Apple Design Award-quality apps use .sensoryFeedback() on primary actions for tactile response.",
    });
  } else if (hasSensoryFeedback) {
    passed.push("Haptic feedback (.sensoryFeedback)");
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
