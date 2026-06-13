// Admin GraphQL operation catalog.
//
// Every snippet here is validated against the live Admin API schema (pinned
// ADMIN_API_VERSION) via the Shopify MCP `validate_graphql_codeblocks` tool
// before being committed. Injecting these into the engineer prompt is the
// single biggest lever on whether a generated app actually runs: the model
// assembles real, current operations instead of hallucinating fields.
//
// When bumping ADMIN_API_VERSION, re-validate this catalog and fix any drift.

export interface AdminOperation {
  id: string;
  rootField: string;
  type: "query" | "mutation";
  scopes: string[];
  description: string;
  graphql: string;
}

export const ADMIN_OPERATIONS: AdminOperation[] = [
  {
    id: "products_list",
    rootField: "products",
    type: "query",
    scopes: ["read_products"],
    description: "Paginated product list with status, inventory, and image.",
    graphql: `#graphql
query Products($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: TITLE) {
    edges { node { id title status totalInventory featuredMedia { preview { image { url altText } } } } }
    pageInfo { hasNextPage endCursor }
  }
}`,
  },
  {
    id: "variants_bulk_update",
    rootField: "productVariantsBulkUpdate",
    type: "mutation",
    scopes: ["write_products"],
    description: "Bulk-update variant prices (or other fields) for one product.",
    graphql: `#graphql
mutation BulkUpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id price }
    userErrors { field message }
  }
}`,
  },
  {
    id: "low_stock_variants",
    rootField: "productVariants",
    type: "query",
    scopes: ["read_products", "read_inventory"],
    description: "Variants with on-hand inventory quantity — use to find low stock.",
    graphql: `#graphql
query LowStock($first: Int!, $after: String) {
  productVariants(first: $first, after: $after) {
    edges { node { id title inventoryQuantity product { id title } } }
    pageInfo { hasNextPage endCursor }
  }
}`,
  },
  {
    id: "inventory_adjust",
    rootField: "inventoryAdjustQuantities",
    type: "mutation",
    scopes: ["write_inventory"],
    description: "Adjust on-hand inventory quantities at a location.",
    graphql: `#graphql
mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    inventoryAdjustmentGroup { createdAt reason }
    userErrors { field message }
  }
}`,
  },
  {
    id: "orders_list",
    rootField: "orders",
    type: "query",
    scopes: ["read_orders"],
    description: "Recent orders with totals and fulfillment status.",
    graphql: `#graphql
query Orders($first: Int!, $after: String) {
  orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
    edges {
      node {
        id name createdAt displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`,
  },
  {
    id: "order_update_tags",
    rootField: "orderUpdate",
    type: "mutation",
    scopes: ["write_orders"],
    description: "Update an order — e.g. add tags.",
    graphql: `#graphql
mutation TagOrder($input: OrderInput!) {
  orderUpdate(input: $input) {
    order { id tags }
    userErrors { field message }
  }
}`,
  },
  {
    id: "customers_list",
    rootField: "customers",
    type: "query",
    scopes: ["read_customers"],
    description: "Customers with order count and lifetime spend (protected data).",
    graphql: `#graphql
query Customers($first: Int!, $after: String) {
  customers(first: $first, after: $after) {
    edges { node { id displayName numberOfOrders amountSpent { amount currencyCode } } }
    pageInfo { hasNextPage endCursor }
  }
}`,
  },
  {
    id: "customer_update_tags",
    rootField: "customerUpdate",
    type: "mutation",
    scopes: ["write_customers"],
    description: "Update a customer — e.g. apply a segment tag.",
    graphql: `#graphql
mutation TagCustomer($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer { id tags }
    userErrors { field message }
  }
}`,
  },
  {
    id: "discount_create",
    rootField: "discountCodeBasicCreate",
    type: "mutation",
    scopes: ["write_discounts"],
    description: "Create a basic code discount (percentage or fixed amount).",
    graphql: `#graphql
mutation CreateDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
  discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
    codeDiscountNode { id }
    userErrors { field message }
  }
}`,
  },
  {
    id: "metafields_set",
    rootField: "metafieldsSet",
    type: "mutation",
    scopes: ["write_products"],
    description: "Set metafields on any resource (e.g. a product badge).",
    graphql: `#graphql
mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id key namespace value }
    userErrors { field message }
  }
}`,
  },
];

const BY_ROOT_FIELD = new Map(ADMIN_OPERATIONS.map((op) => [op.rootField.toLowerCase(), op]));
const BY_ID = new Map(ADMIN_OPERATIONS.map((op) => [op.id, op]));

// Menu shown to the architect so it picks real root fields.
export const ADMIN_OPERATION_MENU: string = ADMIN_OPERATIONS
  .map((op) => `- "${op.rootField}" (${op.type}): ${op.description} [scopes: ${op.scopes.join(", ")}]`)
  .join("\n");

// Resolve the architect's chosen rootFields/ids to validated snippets and
// render them for the engineer prompt. Unknown choices are skipped silently.
export function getValidatedOperations(choices: string[]): { snippets: string; scopes: string[] } {
  const seen = new Set<string>();
  const matched: AdminOperation[] = [];
  for (const choice of choices ?? []) {
    const key = choice.trim();
    const op = BY_ID.get(key) ?? BY_ROOT_FIELD.get(key.toLowerCase());
    if (op && !seen.has(op.id)) {
      seen.add(op.id);
      matched.push(op);
    }
  }
  if (matched.length === 0) return { snippets: "", scopes: [] };

  const snippets = matched
    .map((op) => `// ${op.description}\n// scopes: ${op.scopes.join(", ")}\n${op.graphql}`)
    .join("\n\n");
  const scopes = [...new Set(matched.flatMap((op) => op.scopes))];

  return {
    snippets: `## VALIDATED ADMIN GRAPHQL OPERATIONS\n// These are validated against the Admin API. Use them as-is inside loaders/actions\n// via admin.graphql(...). Do NOT invent fields or alter operation shapes.\n\n${snippets}`,
    scopes,
  };
}
