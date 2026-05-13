// Regenerates a single file within a generated project using AI
// POST body: { filePath, currentContent, prompt, appContext }
// Returns: { content: string }
// Available to Pro+ users only.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { callAI, AIError, DEFAULT_MODELS, getApiKey, Provider } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a Principal iOS Engineer specializing in SwiftUI and Swift 6. You are given:
1. The original app prompt that describes what the user wanted to build
2. Context about the app (app name, summary)
3. A specific file path and its current content
4. An optional instruction about what to change

Your task is to produce an improved or corrected version of that single file.

Rules:
- Output ONLY the complete file content — no markdown fences, no explanation, no preamble
- The file must compile under Swift 6 strict concurrency
- Maintain consistency with the rest of the project (use @Observable, SwiftData, NavigationStack, etc.)
- If no specific change instruction is given, improve the file's code quality, design, and completeness
- Never truncate — always return the complete file`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth required
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

  // Plan check — Pro+ only
  const adminSupabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: planData } = await adminSupabase.rpc("get_user_plan", { p_user_id: user.id });
  const plan = (planData as string) ?? "free";
  if (plan === "free") {
    return new Response(JSON.stringify({ error: "File regeneration requires a Pro or Studio plan. Upgrade at /pricing." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { filePath, currentContent, prompt, appContext, instruction, provider: rawProvider } = await req.json();
  if (!filePath || !currentContent) {
    return new Response(JSON.stringify({ error: "filePath and currentContent are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provider: Provider = ["gemini", "anthropic", "opencode"].includes(rawProvider) ? rawProvider : "gemini";
  // Premium providers are Studio-only — mirror the gate in generate-ios-app
  // so Pro users can't force anthropic/opencode and bypass tier monetization.
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

  const userMessage = `App prompt: "${prompt}"
App context: ${JSON.stringify(appContext)}

File to regenerate: ${filePath}
${instruction ? `Change instruction: ${instruction}` : "Improve this file's quality, completeness, and design."}

Current file content:
\`\`\`swift
${currentContent}
\`\`\`

Return the complete improved file content now (no markdown, no explanation):`;

  try {
    const result = await callAI({
      provider,
      apiKey,
      model: DEFAULT_MODELS[provider].engineer,
      system: SYSTEM_PROMPT,
      userMessage,
      maxTokens: 8000,
    });
    const content = result.text;
    if (!content) throw new Error("AI returned empty content");

    // Strip any accidental markdown fences
    const cleaned = content.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();

    return new Response(JSON.stringify({ content: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("regenerate-file error:", err);
    const msg = err instanceof AIError ? err.message : err instanceof Error ? err.message : "Unknown error";
    const status = err instanceof AIError && err.status >= 400 && err.status < 600 ? err.status : 500;
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
