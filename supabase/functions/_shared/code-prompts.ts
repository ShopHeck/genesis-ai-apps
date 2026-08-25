import { FORBIDDEN_IMPORT_SPECS } from "./shopify.ts";

// Target-aware code-assistant rules shared by regenerate-file (single file) and
// refine-project (conversational rebuild). The old regenerate-file path was wired
// to a removed iOS (SwiftUI/Swift 6) pipeline; these are the target-aware
// replacements so Pro/Studio "Regenerate file" and "Refine with AI" actually
// produce code for the product we ship (Shopify or web).

export type CodeTarget = "shopify" | "web";

export function normalizeTarget(t: unknown): CodeTarget {
  return t === "shopify" || t === "web" ? t : "shopify";
}

export function codeTargetLabel(target: CodeTarget): string {
  return target === "shopify" ? "Shopify embedded-admin (React Router + Polaris + Prisma + Admin GraphQL)" : "React + TypeScript + Tailwind (Vite)";
}

// English description of the conventions an engineer must follow for a target.
const SHOPIFY_RULES = `You are a Senior Shopify App Engineer building in the official React Router template
(@shopify/shopify-app-react-router, @shopify/polaris, Prisma, Admin GraphQL).

Hard rules (violations cause automated rejection):
1. TypeScript strict — no \`any\`, no \`// @ts-ignore\`.
2. EVERY route loader/action authenticates: \`const { admin, session } = await authenticate.admin(request);\`.
3. ALL store data comes from the Admin GraphQL API via \`admin.graphql(\\\`#graphql ...\\\`, { variables })\` inside loaders/actions — never hardcode catalog data.
4. UI uses ONLY @shopify/polaris components (Page, Card, Layout, IndexTable, BlockStack, Text, Button, etc.). No raw HTML layout, no inline styles, no Tailwind.
5. App-owned data uses Prisma, always scoped by \`shop\` (from session.shop).
6. Provide an empty state for every index/list screen.
7. Return COMPLETE, runnable code — no TODOs, no stubs, no placeholders.
8. IMPORT WHITELIST — this template installs ONLY these packages, so every import MUST come from exactly them:
   react, react-dom, react-router, @react-router/node, @react-router/serve, @react-router/fs-routes,
   @react-router/dev, @shopify/polaris, @shopify/app-bridge-react, @shopify/shopify-app-react-router,
   @shopify/shopify-app-session-storage-prisma, @prisma/client, prisma, plus relative imports (../, ./).
   FORBIDDEN (NOT installed; break \`shopify app dev\`): ${FORBIDDEN_IMPORT_SPECS.join(", ")}.
   Use \`import { authenticate } from "../shopify.server"\` — do NOT import a separate session/authenticator.`;

const WEB_RULES = `You are a Senior React Engineer building a production-grade React + TypeScript + Tailwind CSS app (Vite).

Hard rules:
1. TypeScript strict — no \`any\`, no \`// @ts-ignore\`.
2. Functional components + hooks. Use lucide-react for icons and framer-motion for motion.
3. Responsive, accessible UI (semantic HTML, visible focus states). Prefer Tailwind utilities; avoid inline style objects where a class would do.
4. App state via React state/hooks (or @tanstack/react-query where appropriate). Don't hardcode data that should be fetched.
5. Provide a friendly empty state for every empty list/screen.
6. Return COMPLETE, runnable code — no TODOs, no stubs, no placeholders.`;

export function codeAssistantRules(target: CodeTarget): string {
  return target === "shopify" ? SHOPIFY_RULES : WEB_RULES;
}

// Best-effort human-readable language for a file path, used to give the model
// unambiguous context about what it is editing.
export function languageForPath(path: string): string {
  if (/\.tsx$/.test(path)) return "TypeScript/TSX";
  if (/\.ts$/.test(path)) return "TypeScript";
  if (/\.jsx$/.test(path)) return "JSX";
  if (/\.js$/.test(path)) return "JavaScript";
  if (/\.css$/.test(path)) return "CSS";
  if (/\.scss$/.test(path)) return "SCSS";
  if (/\.prisma$/.test(path)) return "Prisma schema";
  if (/\.sql$/.test(path)) return "SQL";
  if (/\.toml$/.test(path)) return "TOML (shopify.app.toml / app config)";
  if (/\.json$/.test(path)) return "JSON";
  if (/\.[c|m]?tsx$/i.test(path)) return "TypeScript/TSX";
  if (/\.md$/.test(path)) return "Markdown";
  if (/\.html$/.test(path)) return "HTML";
  if (/\.graphql$/.test(path)) return "GraphQL";
  return "code";
}
