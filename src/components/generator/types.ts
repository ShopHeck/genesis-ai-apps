export type GeneratedFile = { path: string; content: string };

export type Project = {
  appName: string;
  bundleId: string;
  summary: string;
  files: GeneratedFile[];
  plan?: Record<string, unknown>;
  reviewScore?: number;
};

export type PromptTemplate = {
  label: string;
  category: string;
  emoji: string;
  prompt: string;
  tagline: string;
  signature: string;
  screens: string[];
  accent: string;
};

export type Stage = "idle" | "analyzing" | "generating" | "bundling" | "done" | "error";

export type LogKind = "system" | "thought" | "action" | "success" | "error";

export type LogLine = { id: number; ts: number; kind: LogKind; text: string };
