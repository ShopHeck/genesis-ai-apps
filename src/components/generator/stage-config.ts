import { Brain, Code2, Package, Check } from "lucide-react";
import type { Stage, LogKind } from "./types";

export const STAGES: { id: Exclude<Stage, "idle" | "error">; label: string; webLabel?: string; hint: string; webHint?: string; icon: typeof Brain }[] = [
  { id: "analyzing", label: "Analyzing your prompt", hint: "Designing app architecture & minimal access scopes", webHint: "Designing app architecture & feature set", icon: Brain },
  { id: "generating", label: "Generating Shopify app code", webLabel: "Generating React source files", hint: "Writing React Router routes, Polaris UI & Admin API calls", webHint: "Writing React components, hooks & Tailwind styles", icon: Code2 },
  { id: "bundling", label: "Bundling Shopify app", webLabel: "Bundling web project", hint: "Packaging the React Router app into a downloadable .zip", webHint: "Packaging files into a downloadable .zip", icon: Package },
  { id: "done", label: "Ready to install", webLabel: "Ready to deploy", hint: "Run `shopify app dev` to install on your dev store", webHint: "Run npm install && npm run dev to preview", icon: Check },
];

export const STAGE_SCRIPT: Record<Exclude<Stage, "idle" | "error" | "done">, { kind: LogKind; text: string }[]> = {
  analyzing: [
    { kind: "system", text: "$ apex build --target shopify --template react-router" },
    { kind: "action", text: "[agent] booting architect · model=gemini-2.5-pro" },
    { kind: "thought", text: "› parsing intent and extracting merchant features…" },
    { kind: "thought", text: "› choosing archetype: embedded admin (App Bridge + Polaris)" },
    { kind: "thought", text: "› minimizing access scopes for Built for Shopify" },
    { kind: "thought", text: "› mapping screens → React Router routes" },
    { kind: "action", text: "[plan] feature graph stabilized · scopes resolved" },
  ],
  generating: [
    { kind: "action", text: "[codegen] injecting React Router scaffold (OAuth, sessions, webhooks)" },
    { kind: "thought", text: "› writing app/shopify.server.ts + Prisma session storage" },
    { kind: "thought", text: "› generating Polaris route components" },
    { kind: "thought", text: "› wiring Admin GraphQL queries in loaders" },
    { kind: "thought", text: "› authenticating every loader/action with authenticate.admin" },
    { kind: "thought", text: "› adding empty states and save bars" },
    { kind: "action", text: "[lint] Built for Shopify checks · passing" },
  ],
  bundling: [
    { kind: "action", text: "[bundler] compressing app tree…" },
    { kind: "thought", text: "› verifying shopify.app.toml + prisma/schema.prisma" },
    { kind: "action", text: "[bundler] writing apex-shopify-app.zip" },
  ],
};
