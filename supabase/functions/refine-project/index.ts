// Refines a generated project from a natural-language instruction (the "Refine
// with AI" conversational rebuild). Target-aware: produces patches for the
// Shopify (React Router + Polaris + Prisma) or web (React + Tailwind) target.
// Replaces the broken iOS-era misuse where RefinementChat routed a whole-project
// patch through the single-file regenerate-file Swift prompt.
//
// POST body:
//   {
//     target: "shopify" | "web",
//     prompt: string,               // the original app idea
//     appContext: { appName, summary, bundleId? },
//     instruction: string,          // what to change
//     provider: "gemini" | "anthropic" | "opencode",
//     files: Array<{ path, content }>  // current project files
//   }
// Returns: { files: Array<{ path, content }>, summary?: string }
// Pro+ only (Studio gates premium providers).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { callAI, AIError, AITool, DEFAULT_MODELS, getApiKey, Provider } from "../_shared/ai.ts";
import { codeAssistantRules, normalizeTarget } from "../_shared/code-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOL_PATCH: AITool = {
  name: "emit_patched_files",
  description: "Emit the full content of only the files changed to implement the instruction.",
  parameters: {
    type: "object",
    properties: {
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "The exact file path that changed, e.g. app/routes/app._index.tsx" },
            content: { type: "string", description: "The COMPLETE new content of that file" },
          },
          required: ["path", "content"],
        },
      },
      summary: { type: "string", description: "One short sentence describing what changed." },
    },
    required: ["files"],
  },
};

function systemPrompt(target: "shopify" | "web"): string {
  return `You are a Senior Engineer whose specialty is implementing requests against an existing generated
app in the ${target === "shopify" ? "Shopify embedded-admin" : "React + Tailwind web"} stack.

${codeAssistantRules(target)}

You will receive the current project files and a plain-English change request. Implement it:
- Change as few files as needed; leave unrelated files untouched.
- Preserve the existing design system, conventions, route paths, and component contracts; don't rename files unless the instruction requires it.
- When you change a file, return its COMPLETE new content (never a diff or a fragment), or the client cannot apply it.

Use the tool to emit your structured result.`;
}

// Build a bounded manifest + inline file content so a large project doesn't exceed
// the context window. Unlisted/truncated files are still in the manifest so the
// model knows they exist; the client keeps unchanged files as-is.
const MAX_CONTENT_CHARS = 100_000;
const MAX_FILES_INLINED = 30;
const MAX_FILE_CHARS = 12_000;

function buildProjectContext(files: { path: string; content: string }[]): { text: string; truncated: boolean } {
  const manifest = files
    .map((f) => `- ${f.path} (${f.content.split("\n").length} lines)`)
    .join("\n");
  const parts: string[] = [`File manifest:\n${manifest}\n\nCurrent file contents:\n`];
  let budget = MAX_CONTENT_CHARS;
  let truncated = false;

  for (let i = 0; i < files.length; i++) {
    if (budget <= 0 || i >= MAX_FILES_INLINED) {
      truncated = true;
      break;
    }
    const f = files[i];
    const body = f.content.length > MAX_FILE_CHARS ? f.content.slice(0, MAX_FILE_CHARS) + "\n/* …truncated… */" : f.content;
    const block = `// === ${f.path} ===\n${body}\n\n`;
    if (block.length > budget) {
      truncated = true;
      break;
    }
    parts.push(block);
    budget -= block.length;
  }

  if (truncated) {
    parts.push("(Some files were omitted for size. Do NOT edit files whose content was not provided; if you must, include their complete replacement content.)\n");
  }
  return { text: parts.join(""), truncated };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pro+ only.
  const adminSupabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: planData } = await adminSupabase.rpc("get_user_plan", { p_user_id: user.id });
  const plan = (planData as string) ?? "free";
  if (plan === "free") {
    return new Response(JSON.stringify({ error: "Iterative refinement requires a Pro or Studio plan. Upgrade at /pricing." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { target: rawTarget, prompt, appContext, instruction, provider: rawProvider, files } = await req.json();
  if (!Array.isArray(files) || files.length === 0 || !instruction?.trim()) {
    return new Response(JSON.stringify({ error: "files and a non-empty instruction are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provider: Provider = ["gemini", "anthropic", "opencode"].includes(rawProvider) ? rawProvider : "gemini";
  if (provider !== "gemini" && plan !== "studio") {
    return new Response(
      JSON.stringify({ error: `${provider === "anthropic" ? "Claude" : "Opencode Zen"} requires the Studio plan. Upgrade at /pricing.` }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    return new Response(JSON.stringify({ error: `${provider} API key not configured on the server.` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const target = normalizeTarget(rawTarget);
  const ctx = buildProjectContext(files as { path: string; content: string }[]);

  const userMessage = `Target stack: ${target}
Original app idea: "${prompt}"
App: ${appContext?.appName ?? "Untitled"} — ${appContext?.summary ?? ""}

Change request:
${instruction}

${ctx.text}

Return ONLY the files you changed, each with its complete new content. Preserve the exact path strings.`;

  try {
    const result = await callAI({
      provider,
      apiKey,
      model: DEFAULT_MODELS[provider].engineer,
      system: systemPrompt(target),
      userMessage,
      tool: TOOL_PATCH,
      maxTokens: 32000,
      timeoutMs: 120_000,
    });

    const patch = (result.toolArgs ?? {}) as { files?: { path: string; content: string }[]; summary?: string };
    const patchedFiles = (patch.files ?? []).filter((f) => f?.path && typeof f.content === "string");
    if (patchedFiles.length === 0) throw new Error("The model produced no file changes. Try being more specific.");

    return new Response(JSON.stringify({ files: patchedFiles, summary: patch.summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("refine-project error:", err);
    const msg = err instanceof AIError ? err.message : err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof AIError && err.status >= 400 && err.status < 600 ? err.status : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
