import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  Send,
  Loader2,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Project } from "./types";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  filesChanged?: string[];
  timestamp: number;
};

const SUGGESTIONS = [
  "Change the accent color to blue",
  "Add a settings screen with dark mode toggle",
  "Make the list use a grid layout",
  "Add a search bar to the main screen",
  "Add pull-to-refresh to the list view",
];

export function RefinementChat({
  project,
  prompt,
  provider,
  onProjectUpdate,
}: {
  project: Project;
  prompt: string;
  provider: "gemini" | "anthropic" | "opencode";
  onProjectUpdate: (project: Project) => void;
}) {
  const { user, plan } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const msgIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;

    if (!user) {
      toast.error("Sign in to use iterative refinement");
      return;
    }
    if (plan === "free") {
      toast.error("Iterative refinement requires a Pro or Studio plan");
      return;
    }

    setInput("");
    const userMsg: ChatMessage = {
      id: ++msgIdRef.current,
      role: "user",
      text: msg,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const fileSummaries = project.files
        .map((f) => `- ${f.path} (${f.content.split("\n").length} lines)`)
        .join("\n");

      const { data, error: fnErr } = await supabase.functions.invoke(
        "regenerate-file",
        {
          body: {
            filePath: "__refinement__",
            currentContent: JSON.stringify({
              files: project.files.map((f) => ({
                path: f.path,
                content: f.content,
              })),
            }),
            prompt,
            appContext: {
              appName: project.appName,
              summary: project.summary,
              bundleId: project.bundleId,
              fileManifest: fileSummaries,
            },
            instruction: msg,
            provider,
          },
        },
      );

      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      const content = data?.content ?? "";
      let patchedFiles: { path: string; content: string }[] = [];
      let responseText = "";

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          patchedFiles = parsed;
        } else if (parsed.files && Array.isArray(parsed.files)) {
          patchedFiles = parsed.files;
          responseText = parsed.summary ?? "";
        }
      } catch {
        responseText = content.slice(0, 500);
      }

      if (patchedFiles.length > 0) {
        const updatedFiles = project.files.map((f) => {
          const patch = patchedFiles.find((p) => p.path === f.path);
          return patch ? { ...f, content: patch.content } : f;
        });

        const newFiles = patchedFiles.filter(
          (p) => !project.files.some((f) => f.path === p.path),
        );

        const allFiles = [...updatedFiles, ...newFiles];
        const changedPaths = patchedFiles.map((p) => p.path);

        onProjectUpdate({ ...project, files: allFiles });

        const assistantMsg: ChatMessage = {
          id: ++msgIdRef.current,
          role: "assistant",
          text:
            responseText ||
            `Updated ${changedPaths.length} file${changedPaths.length !== 1 ? "s" : ""}`,
          filesChanged: changedPaths,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        toast.success(`${changedPaths.length} file${changedPaths.length !== 1 ? "s" : ""} updated`);
      } else {
        const assistantMsg: ChatMessage = {
          id: ++msgIdRef.current,
          role: "assistant",
          text: responseText || "I processed your request but no file changes were produced. Try being more specific.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Refinement failed";
      const assistantMsg: ChatMessage = {
        id: ++msgIdRef.current,
        role: "assistant",
        text: `Error: ${errMsg}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="glass-panel overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-card/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-primary" />
          <span className="font-display text-sm font-semibold">
            Refine with AI
          </span>
          <span className="text-[10px] text-muted-foreground">
            — describe changes in plain English
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={16} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/40">
          {messages.length === 0 && (
            <div className="px-6 py-5">
              <p className="text-xs text-muted-foreground mb-3">
                Tell the AI what to change — it will patch only the affected
                files instead of regenerating the whole project.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    disabled={loading}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                  >
                    <Sparkles size={10} className="inline mr-1" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <div className="max-h-80 overflow-y-auto px-6 py-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card/60 border border-border/40 text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.filesChanged && m.filesChanged.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.filesChanged.map((f) => (
                          <span
                            key={f}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          >
                            <Check size={9} className="inline mr-0.5" />
                            {f.split("/").pop()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="bg-card/60 border border-border/40 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    Patching files…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          <div className="px-6 py-3 border-t border-border/40 bg-card/20">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  plan === "free"
                    ? "Upgrade to Pro to use refinement…"
                    : "e.g. Make the header gradient purple…"
                }
                disabled={loading || plan === "free"}
                className="flex-1 bg-background/60 border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <Button
                onClick={() => handleSend()}
                disabled={loading || !input.trim() || plan === "free"}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </Button>
            </div>
            {plan === "free" && (
              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                <AlertTriangle size={10} />
                Iterative refinement is available on Pro and Studio plans
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
