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
    { kind: "action", text: "[agent] booting planner · model=gemini-2.5-pro" },
    { kind: "thought", text: "› parsing intent and extracting feature set…" },
    { kind: "thought", text: "› choosing architecture: MV + @Observable + SwiftData" },
    { kind: "thought", text: "› mapping screens → NavigationStack routes" },
    { kind: "thought", text: "› selecting Apple frameworks (Charts, HealthKit?, WidgetKit?)" },
    { kind: "action", text: "[plan] feature graph stabilized · entities resolved" },
  ],
  generating: [
    { kind: "action", text: "[codegen] scaffolding Xcode project (XcodeGen)" },
    { kind: "thought", text: "› writing App.swift entry point with @main" },
    { kind: "thought", text: "› generating SwiftUI views and view models" },
    { kind: "thought", text: "› defining @Model SwiftData schema" },
    { kind: "thought", text: "› wiring NavigationStack + deep link routes" },
    { kind: "thought", text: "› adding accessibility labels & Dynamic Type" },
    { kind: "thought", text: "› adopting Swift 6 strict concurrency (Sendable, actors)" },
    { kind: "thought", text: "› generating Assets.xcassets + AppIcon" },
    { kind: "action", text: "[lint] passing SwiftLint · 0 warnings" },
  ],
  bundling: [
    { kind: "action", text: "[bundler] compressing project tree…" },
    { kind: "thought", text: "› verifying project.yml + Info.plist keys" },
    { kind: "action", text: "[bundler] writing apex-build.zip" },
  ],
};
