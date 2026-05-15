import { Brain, Code2, Package, Check } from "lucide-react";
import type { Stage, LogKind } from "./types";

export const STAGES: { id: Exclude<Stage, "idle" | "error">; label: string; hint: string; icon: typeof Brain }[] = [
  { id: "analyzing", label: "Analyzing your prompt", hint: "Designing app architecture & feature set", icon: Brain },
  { id: "generating", label: "Generating Swift source files", hint: "Writing SwiftUI views, models & SwiftData schema", icon: Code2 },
  { id: "bundling", label: "Bundling Xcode project", hint: "Packaging files into a downloadable .zip", icon: Package },
  { id: "done", label: "Ready for Xcode", hint: "Open in Xcode 16+, sign, and ship", icon: Check },
];

export const STAGE_SCRIPT: Record<Exclude<Stage, "idle" | "error" | "done">, { kind: LogKind; text: string }[]> = {
  analyzing: [
    { kind: "system", text: "$ apex build --target ios --xcode 16 --swift 6" },
    { kind: "action", text: "[agent] booting planner \u00b7 model=gemini-2.5-pro" },
    { kind: "thought", text: "\u203a parsing intent and extracting feature set\u2026" },
    { kind: "thought", text: "\u203a choosing architecture: MV + @Observable + SwiftData" },
    { kind: "thought", text: "\u203a mapping screens \u2192 NavigationStack routes" },
    { kind: "thought", text: "\u203a selecting Apple frameworks (Charts, HealthKit?, WidgetKit?)" },
    { kind: "action", text: "[plan] feature graph stabilized \u00b7 entities resolved" },
  ],
  generating: [
    { kind: "action", text: "[codegen] scaffolding Xcode project (XcodeGen)" },
    { kind: "thought", text: "\u203a writing App.swift entry point with @main" },
    { kind: "thought", text: "\u203a generating SwiftUI views and view models" },
    { kind: "thought", text: "\u203a defining @Model SwiftData schema" },
    { kind: "thought", text: "\u203a wiring NavigationStack + deep link routes" },
    { kind: "thought", text: "\u203a adding accessibility labels & Dynamic Type" },
    { kind: "thought", text: "\u203a adopting Swift 6 strict concurrency (Sendable, actors)" },
    { kind: "thought", text: "\u203a generating Assets.xcassets + AppIcon" },
    { kind: "action", text: "[lint] passing SwiftLint \u00b7 0 warnings" },
  ],
  bundling: [
    { kind: "action", text: "[bundler] compressing project tree\u2026" },
    { kind: "thought", text: "\u203a verifying project.yml + Info.plist keys" },
    { kind: "action", text: "[bundler] writing apex-build.zip" },
  ],
};
