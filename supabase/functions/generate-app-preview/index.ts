// Generates an interactive HTML/CSS/JS preview of the iOS app
// so users can click around and test the interface in the browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert UI prototyper. You convert iOS SwiftUI app concepts into a single-file, fully interactive HTML preview that mimics the look and feel of a native iOS 18 app.

Hard requirements:
- Output a SINGLE complete HTML document (DOCTYPE + <html> + <head> + <body>) with all CSS in a <style> tag and all JS in a <script> tag. No external resources, no CDNs, no images (use emoji or SF-style unicode glyphs and CSS shapes).
- The viewport is a fixed 390x844 area (iPhone 15 logical size). Body must be exactly 390x844, no scroll on body itself; scroll only inside content areas.
- Use a system font stack: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif.
- Native iOS aesthetic: large titles, rounded cards (12-16px radius), subtle dividers, SF-style tab bar at bottom (when applicable), translucent nav bar, haptic-feeling tap states.
- Support BOTH light and dark mode via prefers-color-scheme; default to dark. Use semantic colors: backgrounds #000/#1c1c1e/#2c2c2e (dark) or #fff/#f2f2f7 (light), accents in iOS blue (#0a84ff dark, #007aff light).
- Make it INTERACTIVE: tab navigation, buttons that respond, forms that work, lists you can tap, modals/sheets that open and close, simple state via vanilla JS. Persist nothing.
- Multiple realistic screens reachable through the UI (tabs, push navigation, sheets) — at least 3 distinct views.
- Include sensible seed/sample data so the app feels alive.
- Smooth transitions (200-300ms ease) on view switches and sheet presentations.
- Do NOT include any explanation outside the HTML. Just return the HTML in the tool call.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, appName, summary } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "emit_preview",
          description: "Emit the interactive HTML preview of the app.",
          parameters: {
            type: "object",
            properties: {
              html: {
                type: "string",
                description: "The complete single-file HTML document for the interactive preview.",
              },
            },
            required: ["html"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        max_tokens: 32000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Build an interactive HTML preview for this iOS app concept.\n\nApp name: ${appName ?? "(unnamed)"}\nSummary: ${summary ?? "(none)"}\n\nOriginal idea:\n"""\n${prompt}\n"""\n\nMake it feel like a real native iOS app — multiple screens, tab bar where appropriate, working buttons, realistic sample data. Single 390x844 viewport.`,
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "emit_preview" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error", aiResp.status, text);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Preview generation failed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return a preview." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: { html: string };
    try {
      payload = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("JSON parse error", e);
      return new Response(JSON.stringify({ error: "Invalid preview JSON." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-app-preview error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
