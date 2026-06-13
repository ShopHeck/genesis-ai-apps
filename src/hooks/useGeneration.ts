import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Project, Stage, LogKind, LogLine } from "@/components/generator/types";
import { STAGE_SCRIPT } from "@/components/generator/stage-config";

export interface GenerationState {
  stage: Stage;
  project: Project | null;
  error: string | null;
  elapsed: number;
  logs: LogLine[];
  loading: boolean;
  lastPromptUsed: string;
}

export interface GenerationActions {
  generate: (opts: {
    prompt: string;
    target: "shopify" | "web";
    provider: "gemini" | "anthropic" | "opencode";
    user: { id: string } | null;
    monthlyUsage: number;
    planLimit: number;
    onAuthRequired: () => void;
  }) => Promise<void>;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  reset: () => void;
  terminalRef: React.RefObject<HTMLDivElement | null>;
}

export function useGeneration(): GenerationState & GenerationActions {
  const [stage, setStage] = useState<Stage>("idle");
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [lastPromptUsed, setLastPromptUsed] = useState("");
  const selectedFileRef = useRef<string | null>(null);
  const startedAt = useRef<number | null>(null);
  const logIdRef = useRef(0);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  const loading = stage === "analyzing" || stage === "generating" || stage === "bundling";

  const pushLog = useCallback((kind: LogKind, text: string) => {
    setLogs((prev) => [...prev, { id: ++logIdRef.current, ts: Date.now(), kind, text }]);
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [loading]);

  // Stage script drip (visual log messages)
  useEffect(() => {
    if (stage !== "analyzing" && stage !== "generating" && stage !== "bundling") return;
    const queue = [...STAGE_SCRIPT[stage]];
    let cancelled = false;
    const drip = () => {
      if (cancelled || queue.length === 0) return;
      const next = queue.shift()!;
      pushLog(next.kind, next.text);
      const delay = 600 + Math.random() * 1200;
      setTimeout(drip, delay);
    };
    const t = setTimeout(drip, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [stage, pushLog]);

  // Auto-scroll terminal
  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const reset = useCallback(() => {
    setStage("idle");
    setProject(null);
    setError(null);
    setElapsed(0);
    setLogs([]);
    setLastPromptUsed("");
    logIdRef.current = 0;
    startedAt.current = null;
  }, []);

  const generate = useCallback(async (opts: {
    prompt: string;
    target: "shopify" | "web";
    provider: "gemini" | "anthropic" | "opencode";
    user: { id: string } | null;
    monthlyUsage: number;
    planLimit: number;
    onAuthRequired: () => void;
  }) => {
    const { prompt, target, provider, user, monthlyUsage, planLimit, onAuthRequired } = opts;

    if (prompt.trim().length < 10) {
      toast.error("Describe your app in a bit more detail.");
      return;
    }

    if (user && monthlyUsage >= planLimit) {
      toast.error(`Monthly limit reached (${monthlyUsage}/${planLimit}). Upgrade your plan.`);
      return;
    }

    if (!user) {
      const anonUses = parseInt(localStorage.getItem("apexbuild_anon_uses") ?? "0", 10);
      if (anonUses >= 1) {
        onAuthRequired();
        toast.info("Sign in to get 3 free builds per month.");
        return;
      }
    }

    setError(null);
    setProject(null);
    selectedFileRef.current = null;
    setElapsed(0);
    setLogs([]);
    logIdRef.current = 0;
    startedAt.current = Date.now();
    setLastPromptUsed(prompt);
    setStage("analyzing");
    pushLog("system", `> prompt received (${prompt.trim().length} chars) — target: ${target}`);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const fnUrl = `${supabaseUrl}/functions/v1/${target === "web" ? "generate-web-app" : "generate-shopify-app"}`;

      const resp = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
        },
        body: JSON.stringify({ prompt, provider }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        let errMsg = `Generation failed (${resp.status})`;
        try {
          const j = JSON.parse(errText);
          errMsg = j.error ?? j.message ?? (j.code ? `${j.code}: ${j.message ?? ""}`.trim() : null) ?? errMsg;
        } catch {
          if (errText) errMsg = errText.slice(0, 200);
        }
        throw new Error(errMsg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let resultReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;

          let event: { type: string; [key: string]: unknown };
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "progress") {
            const phase = event.phase as string;
            const message = event.message as string;
            const percent = event.percent as number;
            const isRetry = phase === "retrying";
            const kind: LogKind = phase === "done" ? "success"
              : isRetry ? "warning"
              : phase === "error" ? "error"
              : phase === "bundling" ? "action"
              : phase === "generating" ? "action"
              : "thought";
            pushLog(kind, message ?? phase);
            if (!isRetry && !resultReceived && percent >= 0) {
              if (percent >= 85) setStage("bundling");
              else if (percent >= 30) setStage("generating");
              else setStage("analyzing");
            }
          } else if (event.type === "file") {
            const filePath = event.path as string;
            const fileContent = event.content as string;
            const filePhase = event.phase as string;
            if (filePath && fileContent) {
              setProject(prev => {
                if (!prev) {
                  return { appName: "Generating…", bundleId: "", summary: "", files: [{ path: filePath, content: fileContent }] };
                }
                const existing = prev.files.findIndex(f => f.path === filePath);
                const newFiles = [...prev.files];
                if (existing >= 0) newFiles[existing] = { path: filePath, content: fileContent };
                else newFiles.push({ path: filePath, content: fileContent });
                return { ...prev, files: newFiles };
              });
              if (!selectedFileRef.current) selectedFileRef.current = filePath;
              if (filePhase === "scaffold") {
                pushLog("thought", `[scaffold] ${filePath}`);
              } else {
                pushLog("action", `[engineer] ${filePath}`);
              }
            }
          } else if (event.type === "result") {
            const data = event.project as Project & { plan?: unknown };
            if (!data?.files?.length) throw new Error("Empty project returned.");
            pushLog("success", `[codegen] generated ${data.files.length} files for "${data.appName}"`);

            if (!user) {
              const cur = parseInt(localStorage.getItem("apexbuild_anon_uses") ?? "0", 10);
              localStorage.setItem("apexbuild_anon_uses", String(cur + 1));
            }

            resultReceived = true;
            setProject(data as Project);
            selectedFileRef.current = data.files[0].path;
            setStage("done");
            pushLog("success", "[done] project ready · awaiting download");
            toast.success(`${data.appName} generated — ${data.files.length} files`);

            if (!user) {
              setTimeout(() => {
                toast.info("Sign up to save this project and get more builds", {
                  action: { label: "Sign in", onClick: () => onAuthRequired() },
                  duration: 8000,
                });
              }, 2000);
            }
          } else if (event.type === "patch") {
            const patchedFiles = (event.files as Project["files"]) ?? [];
            if (patchedFiles.length > 0) {
              setProject(prev => prev ? { ...prev, files: patchedFiles } : prev);
              const score = event.reviewScore as number | undefined;
              const beforeScore = event.beforeScore as number | undefined;
              const autoRefined = event.autoRefined as boolean | undefined;

              const sandboxIframe = document.querySelector<HTMLIFrameElement>("iframe[title*='live sandbox']");
              if (sandboxIframe?.contentWindow) {
                sandboxIframe.contentWindow.postMessage({ type: "hmr-update", files: patchedFiles }, "*");
              }

              if (autoRefined && beforeScore !== undefined) {
                pushLog("action", `[quality] auto-refined: ${beforeScore} → ${score ?? "—"}/100 · ${patchedFiles.length} files patched`);
                toast.info(`Quality auto-refined: ${beforeScore} → ${score ?? "—"}/100`);
              } else {
                pushLog("action", `[reviewer] quality score: ${score ?? "—"}/100 · ${patchedFiles.length} files patched`);
                toast.info("Review complete — files updated with quality fixes");
              }
            }
          } else if (event.type === "review") {
            const score = event.reviewScore as number | undefined;
            pushLog("success", `[reviewer] quality score: ${score ?? "—"}/100 · approved`);
          } else if (event.type === "error") {
            throw new Error((event.message as string) ?? "Generation failed");
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      setStage("error");
      pushLog("error", `[error] ${msg}`);
      toast.error(msg);
    }
  }, [pushLog]);

  return {
    stage,
    project,
    error,
    elapsed,
    logs,
    loading,
    lastPromptUsed,
    generate,
    setProject,
    reset,
    terminalRef,
  };
}
