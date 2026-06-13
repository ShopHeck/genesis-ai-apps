// Shopify platform constants — single source of truth for the Shopify app
// generator. Pinned deliberately so generated apps target a known-good API
// surface and can be regenerated against newer versions on purpose.

// Latest STABLE Admin API version (Shopify ships quarterly: YYYY-01/04/07/10).
// Bump intentionally and regression-test generated GraphQL when you do.
export const ADMIN_API_VERSION = "2026-04";

// The scaffold the generator builds on top of. Shopify gives away the
// boilerplate (OAuth, billing, webhooks, session storage) via this template;
// our value is the merchant-specific logic layered on top.
export const APP_TEMPLATE = "react-router" as const;

// App archetypes the generator can target. Phase 1 ships `embedded_admin`.
export type ShopifyAppArchetype =
  | "embedded_admin" // App Home page in the Shopify admin (App Bridge + Polaris)
  | "admin_extension" // Admin UI extension on resource pages
  | "checkout_extension" // Checkout UI extension
  | "pos_extension" // Point of Sale UI extension
  | "sales_channel"; // Sales channel app

// Access scopes a merchant tool can request. Generation must justify and
// minimize scopes — fewer scopes is a Built for Shopify quality signal and
// avoids protected-data review friction.
export const COMMON_SCOPES = [
  "read_products",
  "write_products",
  "read_orders",
  "read_customers",
  "read_inventory",
  "write_inventory",
  "read_discounts",
  "write_discounts",
  "read_metaobjects",
  "write_metaobjects",
] as const;

// Scopes that trigger Shopify's protected customer data requirements — the
// reviewer flags these so generated apps declare a data-handling rationale.
export const PROTECTED_DATA_SCOPES = [
  "read_customers",
  "write_customers",
  "read_orders",
  "read_all_orders",
] as const;

export function isProtectedScope(scope: string): boolean {
  return (PROTECTED_DATA_SCOPES as readonly string[]).includes(scope);
}
