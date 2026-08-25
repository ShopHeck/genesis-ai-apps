// Exports a generated project to a GitHub repository and returns the repo URL.
// The "ship it" moment: instead of only handing the merchant a .zip, we create a
// real, cloneable repo they can connect to a deploy host.
//
// The repo is created under the service account's GitHub (GITHUB_TOKEN / GITHUB_OWNER).
// A future enhancement uses GitHub OAuth so the merchant owns it under their own account;
// for v1 the repo is cloneable/transferable/forkable by the user.
//
// POST (authenticated, Pro+): { appName, files: [{path,content}], repoName?, publicRepo? }
// Returns: { repoUrl, cloneUrl, repoName, commitSha }
//
// Server secrets: GITHUB_TOKEN (fine-grained PAT with Contents read/write + Repositories
// create on the owner, or a classic PAT with `repo` scope). Optional GITHUB_OWNER defaults
// to the token's authenticated user.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API = "https://api.github.com";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const GITHUB_OWNER = Deno.env.get("GITHUB_OWNER") ?? "";

type Json = Record<string, unknown>;
type GhResult = { data: Json; error: string | null };

async function gh(path: string, init: { method?: string; body?: unknown } = {}): Promise<GhResult> {
  const resp = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "apexbuild-export",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await resp.text();
  const data = text ? (JSON.parse(text) as Json) : ({} as Json);
  if (!resp.ok) {
    return { data, error: String(data?.message ?? data?.error ?? `GitHub API ${resp.status}`) };
  }
  return { data, error: null };
}

function base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function resolveOwner(): Promise<{ owner: string; error: string | null }> {
  if (GITHUB_OWNER) return { owner: GITHUB_OWNER, error: null };
  const { data, error } = await gh("/user");
  if (error) return { owner: "", error };
  return { owner: str(data.login), error: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: "GitHub export is not configured on the server (missing GITHUB_TOKEN)." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  // Pro+ only — this creates a repo (a real side effect) and uses API quota.
  const adminSupabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: planData } = await adminSupabase.rpc("get_user_plan", { p_user_id: user.id });
  if ((planData as string) === "free") {
    return new Response(JSON.stringify({ error: "GitHub export requires a Pro or Studio plan. Upgrade at /pricing." }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { appName, files, repoName: rawRepoName, publicRepo } = await req.json();
  if (!Array.isArray(files) || files.length === 0) {
    return new Response(JSON.stringify({ error: "files (non-empty) are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { owner, error: ownerErr } = await resolveOwner();
  if (ownerErr || !owner) {
    return new Response(JSON.stringify({ error: `Could not resolve the GitHub owner: ${ownerErr ?? "unknown"}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const slug = slugify(rawRepoName || `apexbuild-${slugify(appName || "app")}-${Date.now().toString(36)}`);
  if (!slug) {
    return new Response(JSON.stringify({ error: "Could not derive a valid repo name." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) Create the repo.
    const { data: repo, error: repoErr } = await gh(`/repos/${owner}/${slug}`, {
      method: "POST",
      body: {
        name: slug,
        private: !publicRepo,
        description: `Generated with ApexBuild — ${appName ?? "app"}`,
        auto_init: false,
      },
    });
    if (repoErr) {
      if (repoErr.toLowerCase().includes("already exists")) {
        return new Response(JSON.stringify({ error: "A repo with that name already exists on the destination. Leave repoName blank for an auto-generated unique name." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: repoErr }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullName = str(repo.full_name);
    const defaultBranch = str(repo.default_branch, "main");

    // 2) Push the project (plus a README) as one commit via the Git Data API.
    const readme = {
      path: "README.md",
      content: `# ${appName ?? fullName}\n\nGenerated with **ApexBuild**. The complete source is in this repo.\n\n## Setup\nFollow the project files to run it locally (see the generated app's own instructions).\n`,
    };
    const allFiles = [...(files as { path: string; content: string }[]), readme];

    const blobs: Record<string, string> = {};
    for (const f of allFiles) {
      const { data: b, error: bErr } = await gh(`/repos/${fullName}/git/blobs`, {
        method: "POST",
        body: { content: base64(f.content), encoding: "base64" },
      });
      if (bErr) throw new Error(`blob ${f.path}: ${bErr}`);
      blobs[f.path] = str(b.sha);
    }

    const tree = allFiles.map((f) => ({ path: f.path, mode: "100644", type: "blob", sha: blobs[f.path] }));
    const { data: treeRes, error: treeErr } = await gh(`/repos/${fullName}/git/trees`, {
      method: "POST",
      body: { tree },
    });
    if (treeErr) throw new Error(`tree: ${treeErr}`);

    const { data: ref, error: refErr } = await gh(`/repos/${fullName}/git/ref/heads/${defaultBranch}`);
    if (refErr) throw new Error(`ref: ${refErr}`);

    const parentSha = str((ref.object as Json)?.sha);
    const { data: commit, error: commitErr } = await gh(`/repos/${fullName}/git/commits`, {
      method: "POST",
      body: {
        message: `Generated with ApexBuild: ${appName ?? "app"}`,
        tree: treeRes.sha,
        parents: [parentSha],
      },
    });
    if (commitErr) throw new Error(`commit: ${commitErr}`);

    const { error: refUpdateErr } = await gh(`/repos/${fullName}/git/refs/heads/${defaultBranch}`, {
      method: "PATCH",
      body: { sha: commit.sha, force: true },
    });
    if (refUpdateErr) throw new Error(`ref update: ${refUpdateErr}`);

    return new Response(JSON.stringify({
      repoUrl: str(repo.html_url),
      cloneUrl: str(repo.clone_url),
      repoName: fullName,
      commitSha: str(commit.sha),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("export-to-github error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Export failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
