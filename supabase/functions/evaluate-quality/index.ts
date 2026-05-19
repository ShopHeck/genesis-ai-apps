// Visual Quality Evaluator
// Analyzes generated Swift code and preview HTML against a quality rubric.
// Uses Gemini to evaluate visual polish, returning a score and improvement suggestions.
// If score is below threshold, returns targeted refinement instructions.

import { callAI, AIError, AITool, DEFAULT_MODELS, getApiKey, Provider } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUALITY_RUBRIC = `You are a Senior iOS Design Critic evaluating a generated SwiftUI app for visual polish and production quality.

You will receive:
1. The app's plan (design system, screens, seed data)
2. Key Swift source files (Theme.swift, feature views, components)
3. The preview HTML that approximates the app's appearance

Evaluate against this rubric (each dimension 0-10):

## Visual Identity (0-10)
- Does the app have a DISTINCTIVE color scheme (not default iOS blue/gray)?
- Is the accent color used consistently and intentionally?
- Does the typography feel custom (fontDesign, weight hierarchy, tracking)?
- Score 0-3: default iOS look, system blue, no personality
- Score 4-6: custom colors but generic layout
- Score 7-10: distinctive visual brand, recognizable palette

## Component Richness (0-10)
- Are there CUSTOM components (GlassCard, StatTile, etc.) or just default List/Form?
- Do cards have rounded corners, shadows, borders, background materials?
- Are SF Symbols used with hierarchical rendering and effects?
- Score 0-3: plain List cells, default Form
- Score 4-6: some custom styling but repetitive
- Score 7-10: rich custom components with depth and variety

## Animation & Motion (0-10)
- Are there spring animations on entrances?
- Staggered list animations?
- matchedGeometryEffect hero transitions?
- sensoryFeedback on actions?
- Score 0-3: no animations, static views
- Score 4-6: basic .animation() calls
- Score 7-10: spring entrances, stagger, hero transitions, haptics

## Content Quality (0-10)
- Is seed data realistic and specific (not "Item 1", "Lorem ipsum")?
- Are empty states designed (SF Symbol + copy + CTA)?
- Do screens feel populated and alive on first launch?
- Score 0-3: placeholder data, generic text
- Score 4-6: some real data but sparse
- Score 7-10: rich, realistic content throughout

## Layout & Hierarchy (0-10)
- Is there clear visual hierarchy (headers, sections, spacing)?
- Do different screens have distinct layouts (not all identical lists)?
- Is spacing consistent and intentional?
- Score 0-3: flat layout, no hierarchy
- Score 4-6: basic sections but repetitive
- Score 7-10: clear hierarchy, varied layouts, intentional whitespace

## Overall Polish (0-10)
- Does the app feel like it was designed by a human designer?
- Are there delightful micro-interactions?
- Is the navigation structure clear and intuitive?
- Score 0-3: feels auto-generated
- Score 4-6: functional but generic
- Score 7-10: feels handcrafted, delightful

Call "emit_quality_report" with your evaluation.`;

const TOOL_QUALITY_REPORT: { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } } = {
  type: "function",
  function: {
    name: "emit_quality_report",
    description: "Emit the visual quality evaluation report.",
    parameters: {
      type: "object",
      properties: {
        overallScore: {
          type: "number",
          description: "Overall quality score 0-100 (weighted average of dimensions).",
        },
        dimensions: {
          type: "object",
          properties: {
            visualIdentity: { type: "number", description: "0-10 score" },
            componentRichness: { type: "number", description: "0-10 score" },
            animationMotion: { type: "number", description: "0-10 score" },
            contentQuality: { type: "number", description: "0-10 score" },
            layoutHierarchy: { type: "number", description: "0-10 score" },
            overallPolish: { type: "number", description: "0-10 score" },
          },
          required: ["visualIdentity", "componentRichness", "animationMotion", "contentQuality", "layoutHierarchy", "overallPolish"],
          additionalProperties: false,
        },
        verdict: {
          type: "string",
          description: "One of: 'studio' (80+), 'polished' (60-79), 'adequate' (40-59), 'needs_work' (below 40)",
        },
        strengths: {
          type: "array",
          description: "2-3 specific things the app does well.",
          items: { type: "string" },
        },
        improvements: {
          type: "array",
          description: "2-4 specific, actionable improvements. Each should reference a specific file or component and describe exactly what to change.",
          items: {
            type: "object",
            properties: {
              file: { type: "string", description: "File path or 'general'" },
              issue: { type: "string", description: "What's wrong" },
              fix: { type: "string", description: "Specific fix instruction" },
              impact: { type: "string", description: "high, medium, or low" },
            },
            required: ["file", "issue", "fix", "impact"],
            additionalProperties: false,
          },
        },
        summary: {
          type: "string",
          description: "1-2 sentence overall assessment.",
        },
      },
      required: ["overallScore", "dimensions", "verdict", "strengths", "improvements", "summary"],
      additionalProperties: false,
    },
  },
};

function toAITool(t: { function: { name: string; description: string; parameters: Record<string, unknown> } }): AITool {
  return t.function;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { plan, sourceFiles, previewHtml } = await req.json();

    if (!sourceFiles && !previewHtml) {
      return new Response(JSON.stringify({ error: "No source files or preview HTML provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider: Provider = "gemini";
    const apiKey = getApiKey(provider);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build evaluation context
    const planContext = plan
      ? `\n## App Plan\n\`\`\`json\n${JSON.stringify(plan, null, 2).slice(0, 4000)}\n\`\`\``
      : "";

    const sourceContext = sourceFiles
      ? `\n## Swift Source Code\n${(sourceFiles as string).slice(0, 15000)}`
      : "";

    const previewContext = previewHtml
      ? `\n## Preview HTML (first 8000 chars)\n\`\`\`html\n${(previewHtml as string).slice(0, 8000)}\n\`\`\``
      : "";

    const userMessage = `Evaluate this generated iOS app for visual quality and polish.${planContext}${sourceContext}${previewContext}\n\nEvaluate each dimension 0-10 per the rubric. Be critical but fair. Call emit_quality_report.`;

    const result = await callAI({
      provider,
      apiKey,
      model: DEFAULT_MODELS[provider].reviewer,
      system: QUALITY_RUBRIC,
      userMessage,
      tool: toAITool(TOOL_QUALITY_REPORT),
      maxTokens: 4000,
      timeoutMs: 60_000,
    });

    const report = result.toolArgs;
    if (!report) {
      return new Response(JSON.stringify({ error: "Quality evaluation failed — no report returned." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("evaluate-quality error:", e);
    const msg = e instanceof AIError ? e.message : (e instanceof Error ? e.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
