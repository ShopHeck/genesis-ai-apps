// Unified AI provider client for Supabase Edge Functions.
// Supports three direct providers — no third-party gateway:
//   - "gemini"    → Google AI Studio  (generativelanguage.googleapis.com)
//   - "anthropic" → Anthropic         (api.anthropic.com)
//   - "opencode"  → Opencode Zen      (opencode.ai/zen/v1)  [OpenAI-compatible]
//
// All three return a normalized AIResult so callers don't branch on provider.

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
}

export interface AIResult {
  text?: string;                       // populated when no tool was passed
  toolArgs?: Record<string, unknown>;  // populated when tool was passed
}

export class AIError extends Error {
  status: number;
  provider: Provider;
  constructor(provider: Provider, status: number, message: string) {
    super(`[${provider}] ${status}: ${message}`);
    this.provider = provider;
    this.status = status;
  }
}

export async function callAI(opts: AICallOptions): Promise<AIResult> {
  switch (opts.provider) {
    case "gemini":    return callGemini(opts);
    case "anthropic": return callAnthropic(opts);
    case "opencode":  return callOpencode(opts);
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
    throw new AIError("gemini", resp.status, (await resp.text()).slice(0, 400));
  }
  const data = await resp.json();
  const parts: { text?: string; functionCall?: { name: string; args: Record<string, unknown> } }[] =
    data?.candidates?.[0]?.content?.parts ?? [];

  if (opts.tool) {
    const fc = parts.find((p) => p.functionCall)?.functionCall;
    if (!fc?.args) throw new AIError("gemini", 200, "model did not return a tool call");
    return { toolArgs: fc.args };
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
    throw new AIError("anthropic", resp.status, (await resp.text()).slice(0, 400));
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
    throw new AIError("opencode", resp.status, (await resp.text()).slice(0, 400));
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
    architect: "gemini-2.5-pro",
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

export function getApiKey(provider: Provider): string | undefined {
  switch (provider) {
    case "gemini":    return Deno.env.get("GEMINI_API_KEY");
    case "anthropic": return Deno.env.get("ANTHROPIC_API_KEY");
    case "opencode":  return Deno.env.get("OPENCODE_API_KEY");
  }
}
