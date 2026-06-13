// Shopify app scaffold + Polaris pattern guidance.
//
// We build ON TOP of Shopify's official React Router app template: the OAuth,
// session storage, webhook, and billing plumbing is injected here as scaffold
// (Shopify gives this away for free), so the AI engineer spends its output
// budget on the merchant-specific value — routes, Polaris UI, GraphQL Admin
// operations, and Prisma models.
//
// Unlike the web generator, Polaris components come from the @shopify/polaris
// npm package, so the "pattern library" is usage guidance the engineer follows,
// not component source files to inject.

import { ADMIN_API_VERSION } from "../_shared/shopify.ts";

// ─── Polaris pattern guidance (recipes the engineer must follow) ─────────
export interface PolarisPattern {
  id: string;
  name: string;
  description: string;
  recipe: string;
}

export const POLARIS_PATTERNS: PolarisPattern[] = [
  {
    id: "resource_index",
    name: "Resource index (IndexTable)",
    description: "Paginated table of records with bulk actions — the canonical list screen.",
    recipe: `Use <Page>, <Card>, and <IndexTable> with useIndexResourceState for selection.
Wrap rows in <IndexTable.Row> / <IndexTable.Cell>. Provide an emptyState via <EmptyState>.
Example:
  <Page title="Items" primaryAction={{ content: "Add item", url: "/app/items/new" }}>
    <Card padding="0">
      <IndexTable resourceName={{ singular: "item", plural: "items" }} itemCount={items.length}
        selectedItemsCount={...} onSelectionChange={...}
        headings={[{ title: "Name" }, { title: "Status" }]}>
        {rows}
      </IndexTable>
    </Card>
  </Page>`,
  },
  {
    id: "settings_form",
    name: "Settings form (annotated layout)",
    description: "Two-column settings page with descriptions and a contextual save bar.",
    recipe: `Use <Page>, <Layout> with <Layout.AnnotatedSection>, <FormLayout>, <TextField>, <Select>.
Persist with a React Router <Form method="post"> or fetcher; show the App Bridge save bar via
useAppBridge() and the <SaveBar> web component when the form is dirty.`,
  },
  {
    id: "dashboard_overview",
    name: "Dashboard / overview",
    description: "KPI tiles + recent activity for the app home page.",
    recipe: `Use <Page>, <Layout>, <Layout.Section> and a grid of <Card> with <Text variant="headingXl">
for metrics and <BlockStack>/<InlineStack> for layout. Pull real metrics from the Admin API loader.`,
  },
  {
    id: "detail_edit",
    name: "Detail / edit screen",
    description: "Single-record view with a primary form and secondary metadata card.",
    recipe: `Use <Page> with backAction, a primary <Card> containing the edit <FormLayout>, and a
secondary <Card> for status/metadata. Use a React Router action for save/delete.`,
  },
  {
    id: "onboarding_guide",
    name: "Setup guide / onboarding",
    description: "Collapsible, progress-tracked first-run checklist.",
    recipe: `Use <Card> with a <BlockStack> of steps, each with a <Checkbox> or completion badge and a
<ProgressBar>. Persist completion in the app database (Prisma) keyed by shop.`,
  },
  {
    id: "empty_state",
    name: "Empty state",
    description: "Friendly empty state with illustration and primary CTA.",
    recipe: `Use <EmptyState heading="..." action={{ content: "...", url: "..." }} image="...">.
Always provide an empty state for index screens so the app never looks broken on a fresh install.`,
  },
];

export const POLARIS_PATTERN_MENU: string = POLARIS_PATTERNS.map(
  (p) => `- "${p.id}": ${p.name} — ${p.description}`,
).join("\n");

export function getSelectedPolarisPatterns(ids: string[]): string {
  const selected = POLARIS_PATTERNS.filter((p) => ids.includes(p.id));
  if (selected.length === 0) return "";
  const sections = selected.map((p) => `// ── ${p.name} ──\n// ${p.description}\n${p.recipe}`);
  return `## POLARIS PATTERN RECIPES (follow these — do not reinvent layouts)\n\n${sections.join("\n\n")}`;
}

// ─── Static scaffold files (the React Router template plumbing) ──────────
// Engineer must NOT regenerate these — they are injected verbatim.
const STATIC_SCAFFOLD: { path: string; content: string }[] = [
  {
    path: "app/db.server.ts",
    content: `import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

const prisma = global.prismaGlobal ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prismaGlobal = prisma;

export default prisma;
`,
  },
  {
    path: "app/shopify.server.ts",
    content: `import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.${apiVersionEnumMember(ADMIN_API_VERSION)},
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.${apiVersionEnumMember(ADMIN_API_VERSION)};
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
`,
  },
  {
    path: "app/entry.server.tsx",
    content: `import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable, type EntryContext } from "@react-router/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

export const streamTimeout = 5000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={reactRouterContext} url={request.url} />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, { headers: responseHeaders, status: responseStatusCode }),
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );
    setTimeout(abort, streamTimeout + 1000);
  });
}
`,
  },
  {
    path: "app/root.tsx",
    content: `import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
`,
  },
  {
    path: "app/routes/auth.$.tsx",
    content: `import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
`,
  },
  {
    path: "app/routes/webhooks.app.uninstalled.tsx",
    content: `import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(\`Received \${topic} webhook for \${shop}\`);

  // Webhook requests can trigger after an app is uninstalled. If the session
  // no longer exists, the request is a no-op.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
`,
  },
  {
    path: "app/routes/webhooks.app.scopes_update.tsx",
    content: `import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(\`Received \${topic} webhook for \${shop}\`);

  const current = payload.current as string[];
  if (session) {
    await db.session.update({
      where: { id: session.id },
      data: { scope: current.toString() },
    });
  }
  return new Response();
};
`,
  },
  {
    path: "tsconfig.json",
    content: `{
  "include": ["env.d.ts", "**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["@react-router/node", "vite/client"],
    "isolatedModules": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "target": "ES2022",
    "strict": true,
    "allowJs": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "noEmit": true
  }
}
`,
  },
  {
    path: "vite.config.ts",
    content: `import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    allowedHosts: true,
    cors: { preflightContinue: true },
  },
  plugins: [reactRouter(), tsconfigPaths()],
  build: { assetsInlineLimit: 0 },
});
`,
  },
  {
    path: "react-router.config.ts",
    content: `import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
} satisfies Config;
`,
  },
  {
    path: "env.d.ts",
    content: `/// <reference types="@react-router/node" />
/// <reference types="vite/client" />
`,
  },
  {
    path: ".gitignore",
    content: `node_modules
/build
/.cache
/public/build
.env
.dev.vars
.shopify
dev.sqlite
`,
  },
  {
    path: ".env.example",
    content: `SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SCOPES=
DATABASE_URL="file:dev.sqlite"
`,
  },
];

// ApiVersion enum members are PascalCase Month+YY, e.g. "2026-04" -> "April26".
function apiVersionEnumMember(version: string): string {
  const [year, month] = version.split("-");
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const name = months[parseInt(month, 10) - 1] ?? "April";
  return `${name}${year.slice(2)}`;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "shopify-app";
}

// ─── Dynamic scaffold (parameterized by the architect's plan) ────────────
export function getShopifyScaffoldFiles(plan: Record<string, unknown>): { path: string; content: string }[] {
  const appName = (plan.appName as string) ?? "Shopify App";
  const scopes = Array.isArray(plan.scopes) && (plan.scopes as string[]).length
    ? (plan.scopes as string[])
    : ["read_products", "write_products"];
  const navItems = Array.isArray(plan.navigation) ? (plan.navigation as { label: string; route: string }[]) : [];

  const files = [...STATIC_SCAFFOLD];

  files.push({
    path: "package.json",
    content: JSON.stringify({
      name: slug(appName),
      private: true,
      type: "module",
      scripts: {
        build: "react-router build",
        dev: "shopify app dev",
        "db:migrate": "prisma migrate deploy",
        setup: "prisma generate && prisma migrate deploy",
        start: "react-router-serve ./build/server/index.js",
        typecheck: "react-router typegen && tsc --noEmit",
        lint: "eslint --cache --cache-location ./node_modules/.cache/eslint .",
      },
      dependencies: {
        "@prisma/client": "^6.2.1",
        "@react-router/fs-routes": "^7.5.0",
        "@react-router/node": "^7.5.0",
        "@react-router/serve": "^7.5.0",
        "@shopify/app-bridge-react": "^4.1.6",
        "@shopify/polaris": "^13.9.0",
        "@shopify/shopify-app-react-router": "^1.0.0",
        "@shopify/shopify-app-session-storage-prisma": "^6.0.0",
        isbot: "^5.1.0",
        prisma: "^6.2.1",
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router": "^7.5.0",
      },
      devDependencies: {
        "@react-router/dev": "^7.5.0",
        "@types/eslint": "^9.6.1",
        "@types/node": "^22.2.0",
        "@types/react": "^18.2.31",
        "@types/react-dom": "^18.2.14",
        eslint: "^9.0.0",
        typescript: "^5.2.2",
        vite: "^6.2.2",
        "vite-tsconfig-paths": "^5.0.1",
      },
      workspaces: ["extensions/*"],
      engines: { node: "^18.20 || ^20.10 || >=21.0.0" },
    }, null, 2) + "\n",
  });

  files.push({
    path: "shopify.app.toml",
    content: `# Learn more: https://shopify.dev/docs/apps/tools/cli/configuration
name = "${appName}"
client_id = ""
application_url = "https://localhost"
embedded = true

[access_scopes]
scopes = "${scopes.join(",")}"
use_legacy_install_flow = false

[auth]
redirect_urls = [ "https://localhost/auth/callback" ]

[webhooks]
api_version = "${ADMIN_API_VERSION}"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"

  [[webhooks.subscriptions]]
  topics = [ "app/scopes_update" ]
  uri = "/webhooks/app/scopes_update"

[pos]
embedded = false

[build]
automatically_update_urls_on_dev = true
include_config_on_deploy = true
`,
  });

  files.push({
    path: "app/routes/app.tsx",
    content: `import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">Home</Link>
${navItems.map((n) => `        <Link to="${n.route}">${n.label}</Link>`).join("\n") || "        {/* feature links rendered here */}"}
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
`,
  });

  return files;
}

// Paths the engineer must NOT emit (injected scaffold). Used by validation.
export function scaffoldPaths(plan: Record<string, unknown>): Set<string> {
  return new Set(getShopifyScaffoldFiles(plan).map((f) => f.path));
}
