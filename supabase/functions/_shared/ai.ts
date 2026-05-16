// Unified AI provider client for Supabase Edge Functions.
// Supports three direct providers — no third-party gateway:
//   - "gemini"    → Google AI Studio  (generativelanguage.googleapis.com)
//   - "anthropic" → Anthropic         (api.anthropic.com)
//   - "opencode"  → Opencode Zen      (opencode.ai/zen/v1)  [OpenAI-compatible]
//
// All three return a normalized AIResult so callers don't branch on provider.
// Built-in retry with exponential backoff, per-request timeout, and fallback models.

export type Provider = "gemini" | "anthropic" | "opencode";

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface AICallOptions {
  provider: Provider;
  apiKey: string;
  model: string;
  system: string;
  userMessage: string;
  tool?: AITool;       // when present, the model MUST call this tool
  maxTokens?: number;
  maxRetries?: number;         // default 3
  initialRetryDelayMs?: number; // default 2000
  timeoutMs?: number;           // default 120_000 (2 min)
  onRetry?: (attempt: number, maxAttempts: number, delayMs: number, error: AIError) => void;
}

export interface AIResult {
  text?: string;                       // populated when no tool was passed
  toolArgs?: Record<string, unknown>;  // populated when tool was passed
}

export class AIError extends Error {
  status: number;
  provider: Provider;
  retryable: boolean;
  constructor(provider: Provider, status: number, message: string) {
    super(`[${provider}] ${status}: ${message}`);
    this.provider = provider;
    this.status = status;
    this.retryable = RETRYABLE_STATUSES.has(status);
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number): number {
  return ms + Math.random() * ms * 0.3;
}

export async function callAI(opts: AICallOptions): Promise<AIResult> {
  const maxRetries = opts.maxRetries ?? 3;
  const initialDelay = opts.initialRetryDelayMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 120_000;

  let lastError: AIError | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0 && lastError) {
      const delay = jitter(initialDelay * Math.pow(2, attempt - 1));
      opts.onRetry?.(attempt, maxRetries, delay, lastError);
      await sleep(delay);
    }
    try {
      const result = await withTimeout(timeoutMs, () => {
        switch (opts.provider) {
          case "gemini":    return callGemini(opts);
          case "anthropic": return callAnthropic(opts);
          case "opencode":  return callOpencode(opts);
        }
      });
      return result;
    } catch (err) {
      if (err instanceof AIError && err.retryable && attempt < maxRetries) {
        lastError = err;
        continue;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new AIError(opts.provider, 408, `Request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    }
  }
  throw lastError ?? new AIError(opts.provider, 500, "All retries exhausted");
}

async function withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Google AI Studio (Gemini native) ────────────────────────────────────
async function callGemini(opts: AICallOptions): Promise<AIResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`;
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.userMessage }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 8192 },
  };
  if (opts.tool) {
    body.tools = [{ functionDeclarations: [stripUnsupportedSchemaKeys(opts.tool)] }];
    body.toolConfig = {
      functionCallingConfig: { mode: "ANY", allowedFunctionNames: [opts.tool.name] },
    };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const raw = (await resp.text()).slice(0, 400);
    throw new AIError("gemini", resp.status, parseProviderError("gemini", resp.status, raw));
  }
  const data = await resp.json();
  const parts: { text?: string; functionCall?: { name: string; args: Record<string, unknown> } }[] =
    data?.candidates?.[0]?.content?.parts ?? [];

  if (opts.tool) {
    const fc = parts.find((p) => p.functionCall)?.functionCall;
    if (fc?.args) return { toolArgs: fc.args };

    // Fallback: Flash models sometimes return tool args as JSON text instead
    // of a proper functionCall part. Try to extract it.
    const rawText = parts.map((p) => p.text ?? "").join("").trim();
    if (rawText) {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed === "object" && parsed !== null) return { toolArgs: parsed };
        } catch { /* not valid JSON, fall through to retry */ }
      }
    }
    // Use 503 so callAI's retry logic kicks in (200 is not retryable)
    throw new AIError("gemini", 503, "model did not return a tool call — retrying");
  }
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new AIError("gemini", 200, "empty text response");
  return { text };
}

// Gemini rejects "additionalProperties: false" and some JSON Schema keys.
// Recursively strip them so our OpenAI-style tool schemas work as-is.
function stripUnsupportedSchemaKeys(tool: AITool): AITool {
  const clean = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (k === "additionalProperties") continue;
        out[k] = clean(val);
      }
      return out;
    }
    return v;
  };
  return {
    name: tool.name,
    description: tool.description,
    parameters: clean(tool.parameters) as Record<string, unknown>,
  };
}

// ─── Anthropic (Claude) ───────────────────────────────────────────────────
async function callAnthropic(opts: AICallOptions): Promise<AIResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8192,
    system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: opts.userMessage }],
  };
  if (opts.tool) {
    body.tools = [{
      name: opts.tool.name,
      description: opts.tool.description,
      input_schema: opts.tool.parameters,
    }];
    body.tool_choice = { type: "tool", name: opts.tool.name };
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const raw = (await resp.text()).slice(0, 400);
    throw new AIError("anthropic", resp.status, parseProviderError("anthropic", resp.status, raw));
  }
  const data = await resp.json();
  const content: { type: string; text?: string; input?: Record<string, unknown> }[] = data?.content ?? [];

  if (opts.tool) {
    const tu = content.find((b) => b.type === "tool_use");
    if (!tu?.input) throw new AIError("anthropic", 200, "model did not return a tool call");
    return { toolArgs: tu.input };
  }
  const text = content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
  if (!text) throw new AIError("anthropic", 200, "empty text response");
  return { text };
}

// ─── Opencode Zen (OpenAI-compatible) ─────────────────────────────────────
async function callOpencode(opts: AICallOptions): Promise<AIResult> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8192,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.userMessage },
    ],
  };
  if (opts.tool) {
    body.tools = [{
      type: "function",
      function: {
        name: opts.tool.name,
        description: opts.tool.description,
        parameters: opts.tool.parameters,
      },
    }];
    body.tool_choice = { type: "function", function: { name: opts.tool.name } };
  }

  const resp = await fetch("https://opencode.ai/zen/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const raw = (await resp.text()).slice(0, 400);
    throw new AIError("opencode", resp.status, parseProviderError("opencode", resp.status, raw));
  }
  const data = await resp.json();
  const msg = data?.choices?.[0]?.message;

  if (opts.tool) {
    const call = msg?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new AIError("opencode", 200, "model did not return a tool call");
    try {
      return { toolArgs: JSON.parse(call.function.arguments) };
    } catch {
      throw new AIError("opencode", 200, "tool call arguments were not valid JSON");
    }
  }
  const text = (msg?.content ?? "").trim();
  if (!text) throw new AIError("opencode", 200, "empty text response");
  return { text };
}

// ─── Default model IDs per provider ──────────────────────────────────────
// Single source of truth for the model picker UI and edge functions.
export const DEFAULT_MODELS: Record<Provider, { architect: string; engineer: string; reviewer: string }> = {
  gemini: {
    architect: "gemini-2.5-flash",
    engineer:  "gemini-2.5-pro",
    reviewer:  "gemini-2.5-flash",
  },
  anthropic: {
    architect: "claude-sonnet-4-6",
    engineer:  "claude-opus-4-7",
    reviewer:  "claude-haiku-4-5-20251001",
  },
  opencode: {
    architect: "opencode/claude-sonnet-4-6",
    engineer:  "opencode/claude-opus-4-7",
    reviewer:  "opencode/claude-haiku-4-5",
  },
};

// Fallback models used when the primary model is overloaded or unavailable.
export const FALLBACK_MODELS: Record<Provider, { architect: string; engineer: string; reviewer: string }> = {
  gemini: {
    architect: "gemini-2.0-flash",
    engineer:  "gemini-2.5-flash",
    reviewer:  "gemini-2.0-flash",
  },
  anthropic: {
    architect: "claude-haiku-4-5-20251001",
    engineer:  "claude-sonnet-4-6",
    reviewer:  "claude-haiku-4-5-20251001",
  },
  opencode: {
    architect: "opencode/claude-haiku-4-5",
    engineer:  "opencode/claude-sonnet-4-6",
    reviewer:  "opencode/claude-haiku-4-5",
  },
};

export function getApiKey(provider: Provider): string | undefined {
  switch (provider) {
    case "gemini":    return Deno.env.get("GEMINI_API_KEY");
    case "anthropic": return Deno.env.get("ANTHROPIC_API_KEY");
    case "opencode":  return Deno.env.get("OPENCODE_API_KEY");
  }
}

// ─── User-friendly error messages ────────────────────────────────────────
const FRIENDLY_ERRORS: Record<number, string> = {
  429: "AI model rate-limited — retrying with backoff.",
  500: "AI provider internal error — retrying.",
  502: "AI provider temporarily unreachable — retrying.",
  503: "AI model under high demand — retrying with a lighter model.",
  504: "AI provider response timed out — retrying.",
  408: "Request timed out. Try a simpler prompt or try again later.",
};

export function friendlyError(status: number, raw: string): string {
  return FRIENDLY_ERRORS[status] ?? raw;
}

function parseProviderError(_provider: Provider, status: number, raw: string): string {
  try {
    const j = JSON.parse(raw);
    const msg = j?.error?.message ?? j?.error?.status ?? j?.message ?? "";
    if (msg) return `${FRIENDLY_ERRORS[status] ?? ""} ${msg}`.trim();
  } catch { /* not JSON */ }
  return FRIENDLY_ERRORS[status] ?? raw;
}
