// Token-based Admin API access for connected stores. Used to ground generation
// in a merchant's real catalog. Distinct from the generated apps' own
// admin.graphql — this runs server-side with a stored offline access token.

import { ADMIN_API_VERSION } from "./shopify.ts";

export async function adminGraphql<T = unknown>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const resp = await fetch(`https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!resp.ok) {
    throw new Error(`Admin API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  }
  const json = await resp.json();
  if (json.errors) throw new Error(`Admin API errors: ${JSON.stringify(json.errors).slice(0, 200)}`);
  return json.data as T;
}

export interface StoreContext {
  shopName: string;
  currency: string;
  productCount: number;
  sampleProducts: string[];
  collections: string[];
}

const STORE_CONTEXT_QUERY = `#graphql
query StoreContext {
  shop { name currencyCode }
  productsCount { count }
  products(first: 8, sortKey: UPDATED_AT, reverse: true) {
    edges { node { title productType } }
  }
  collections(first: 8) { edges { node { title } } }
}`;

// Fetch a compact snapshot of the merchant's store to ground generation.
// Returns null on any failure so generation falls back to ungrounded mode.
export async function fetchStoreContext(shop: string, accessToken: string): Promise<StoreContext | null> {
  try {
    const data = await adminGraphql<{
      shop: { name: string; currencyCode: string };
      productsCount: { count: number };
      products: { edges: { node: { title: string; productType: string } }[] };
      collections: { edges: { node: { title: string } }[] };
    }>(shop, accessToken, STORE_CONTEXT_QUERY);

    return {
      shopName: data.shop?.name ?? shop,
      currency: data.shop?.currencyCode ?? "USD",
      productCount: data.productsCount?.count ?? 0,
      sampleProducts: (data.products?.edges ?? []).map((e) => e.node.title).filter(Boolean).slice(0, 8),
      collections: (data.collections?.edges ?? []).map((e) => e.node.title).filter(Boolean).slice(0, 8),
    };
  } catch (e) {
    console.error("fetchStoreContext failed (non-fatal):", e);
    return null;
  }
}

export function storeContextPrompt(ctx: StoreContext): string {
  return `## CONNECTED STORE CONTEXT (ground the app in this real store)
- Store: ${ctx.shopName} (${ctx.currency})
- Catalog size: ${ctx.productCount} products
- Sample products: ${ctx.sampleProducts.join(", ") || "n/a"}
- Collections: ${ctx.collections.join(", ") || "n/a"}

Use this real data to inform seed/demo content, copy, and which features matter for THIS merchant.`;
}
