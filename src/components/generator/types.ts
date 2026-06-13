export type GeneratedFile = { path: string; content: string };

export type ComplianceSeverity = "error" | "warning" | "info";
export type ComplianceCheck = {
  id: string;
  label: string;
  severity: ComplianceSeverity;
  passed: boolean;
  detail?: string;
};
export type ComplianceReport = {
  score: number;
  passed: boolean;
  checks: ComplianceCheck[];
};

export type Project = {
  appName: string;
  bundleId: string;
  summary: string;
  files: GeneratedFile[];
  plan?: Record<string, unknown>;
  reviewScore?: number;
  compliance?: ComplianceReport;
};

export type PromptTemplate = {
  label: string;
  category: string;
  tagline: string;
  signature: string;
  screens: string[];
  accent: string;
  emoji: string;
  prompt: string;
};

export type Stage = "idle" | "analyzing" | "generating" | "bundling" | "done" | "error";

export type LogKind = "system" | "thought" | "action" | "success" | "error" | "warning";
export type LogLine = { id: number; ts: number; kind: LogKind; text: string };
