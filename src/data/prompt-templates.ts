import type { PromptTemplate } from "@/components/generator/types";

// Curated Shopify embedded-app ideas. Each maps cleanly to the Admin GraphQL
// API + Polaris and is scoped tightly enough for the generator to produce an
// installable app on the React Router template.
export const EXAMPLE_PROMPTS: PromptTemplate[] = [
  // ───── Inventory & Operations ─────
  {
    category: "Operations",
    label: "Low-stock alerts",
    tagline: "Never sell out of a hero product again.",
    signature: "Per-product reorder points with a daily digest.",
    screens: ["Dashboard", "Thresholds", "Alert log"],
    accent: "#008060",
    emoji: "📦",
    prompt:
      "A low-stock alert app for Shopify merchants. Read inventory levels via the Admin GraphQL API and show a dashboard of products below a configurable threshold. Let merchants set a per-product reorder point (stored in Prisma, keyed by shop). Subscribe to the inventory_levels/update webhook and record an alert when a variant crosses its threshold. Polaris IndexTable for the at-risk list with an empty state, and an annotated settings page for the default threshold. Scopes: read_products, read_inventory.",
  },
  {
    category: "Operations",
    label: "Bulk price editor",
    tagline: "Reprice hundreds of variants in one pass.",
    signature: "Percentage or fixed adjustments with a dry-run preview.",
    screens: ["Select products", "Adjust", "Review & apply"],
    accent: "#5C6AC4",
    emoji: "🏷️",
    prompt:
      "A bulk price editor. Merchants pick a collection or filter products, then apply a percentage or fixed-amount price change. Show a dry-run preview table (current → new price) before committing. Apply changes with the productVariantsBulkUpdate mutation and report success/failures. Use Polaris IndexTable with selection, a Layout form for the adjustment, and a save bar. Scopes: read_products, write_products.",
  },
  {
    category: "Operations",
    label: "Order tagging rules",
    tagline: "Auto-tag orders the moment they come in.",
    signature: "If-this-then-tag rules on order value, items, and country.",
    screens: ["Rules", "New rule", "Activity"],
    accent: "#00848E",
    emoji: "🏷",
    prompt:
      "An order automation app. Merchants define rules (e.g. order total > $200 → tag 'VIP'; ships to CA → tag 'intl') stored in Prisma. Subscribe to the orders/create webhook, evaluate rules, and apply tags via the orderUpdate mutation. Show a rules list, a rule editor with Polaris form controls, and an activity log of recently tagged orders. Scopes: read_orders, write_orders.",
  },

  // ───── Merchandising ─────
  {
    category: "Merchandising",
    label: "Product badges",
    tagline: "Highlight bestsellers and low stock on the storefront.",
    signature: "Rule-driven badges synced to product metafields.",
    screens: ["Badges", "Rules", "Preview"],
    accent: "#9C6ADE",
    emoji: "⭐",
    archetype: "admin_extension",
    prompt:
      "A product badge manager. Merchants create badges (label, color, icon) and rules that assign them — e.g. 'Bestseller' for top sellers, 'Almost gone' under 5 in stock. Persist badge definitions in Prisma and write the assigned badge to a product metafield via metafieldsSet so a theme can render it. Also surface the current badge on the product detail page via an admin UI extension block. Polaris settings page for badge design, a rules editor, and a preview card. Scopes: read_products, write_products, read_inventory.",
  },
  {
    category: "Merchandising",
    label: "Collection scheduler",
    tagline: "Publish and unpublish collections on a timer.",
    signature: "Schedule drops without staying up till midnight.",
    screens: ["Schedule", "New schedule", "History"],
    accent: "#47C1BF",
    emoji: "🗓️",
    prompt:
      "A collection scheduler for product drops. Merchants pick a collection and a publish/unpublish time (stored in Prisma). A scheduled action flips collection publication via publishablePublish / publishableUnpublish at the right time. Show upcoming schedules in a Polaris IndexTable, a scheduling form with date/time pickers, and a history log. Scopes: read_products, write_products.",
  },

  // ───── Marketing ─────
  {
    category: "Marketing",
    label: "Discount campaigns",
    tagline: "Spin up and track promo codes in seconds.",
    signature: "Bulk-generate unique codes with usage analytics.",
    screens: ["Campaigns", "New campaign", "Performance"],
    accent: "#EEC200",
    emoji: "🎟️",
    prompt:
      "A discount campaign manager. Merchants create a campaign (percentage or amount off, usage limit, expiry) and bulk-generate unique codes via discountCodeBasicCreate. Track redemptions by reading discount nodes. Show a campaigns IndexTable, a creation form with Polaris controls, and a performance view with redemption counts. Scopes: read_discounts, write_discounts.",
  },
  {
    category: "Marketing",
    label: "Back-in-stock signups",
    tagline: "Capture demand for sold-out variants.",
    signature: "Customer waitlists with a one-click notify.",
    screens: ["Waitlists", "Signups", "Notify"],
    accent: "#F49342",
    emoji: "🔔",
    archetype: "admin_extension",
    prompt:
      "A back-in-stock waitlist app. Store signups (email + variant id) in Prisma keyed by shop. Subscribe to inventory_levels/update; when a sold-out variant is restocked, surface the waitlist so the merchant can notify customers. Show the waitlist count on the product detail page via an admin UI extension block. Polaris IndexTable of waitlists per product, a signups detail view, and a notify action. Scopes: read_products, read_inventory, read_customers.",
  },

  // ───── Analytics ─────
  {
    category: "Analytics",
    label: "Sales dashboard",
    tagline: "Your store's pulse, at a glance.",
    signature: "Revenue, AOV, and top products in one screen.",
    screens: ["Overview", "Top products", "Orders"],
    accent: "#006FBB",
    emoji: "📊",
    prompt:
      "A sales analytics dashboard. Read orders via the Admin GraphQL API and compute revenue, order count, and average order value for the last 7/30 days. Show KPI cards (Polaris Text + Card grid), a top-products list, and a recent-orders table. Read-only, no persistence required. Scopes: read_orders, read_products.",
  },
  {
    category: "Analytics",
    label: "Inventory aging",
    tagline: "Find the dead stock tying up cash.",
    signature: "Flags slow movers by days-since-last-sale.",
    screens: ["Aging report", "Filters", "Detail"],
    accent: "#DE3618",
    emoji: "🧮",
    prompt:
      "An inventory aging report. Cross-reference current inventory with recent order line items to estimate days since last sale per variant, flagging slow-moving stock. Show a sortable Polaris IndexTable with filters (collection, threshold), and a detail view per product. Read-only. Scopes: read_products, read_inventory, read_orders.",
  },

  // ───── Customer ─────
  {
    category: "Customer",
    label: "VIP segments",
    tagline: "Spot and reward your best customers.",
    signature: "Auto-segments by lifetime spend and order count.",
    screens: ["Segments", "Customers", "Settings"],
    accent: "#50B83C",
    emoji: "👑",
    prompt:
      "A customer segmentation app. Read customers and their order history to compute lifetime value and order count, then bucket them into tiers (e.g. VIP, Loyal, At-risk) by configurable thresholds stored in Prisma. Apply a customer tag for each tier via customerUpdate. Polaris IndexTable of segmented customers, a settings page for thresholds, and an empty state. Note protected customer data scopes. Scopes: read_customers, write_customers, read_orders.",
  },
  {
    category: "Customer",
    label: "Review requests",
    tagline: "Ask for reviews at the perfect moment.",
    signature: "Timed post-delivery follow-ups per order.",
    screens: ["Queue", "Templates", "Sent log"],
    accent: "#BF0711",
    emoji: "✍️",
    prompt:
      "A review request scheduler. Subscribe to the orders/fulfilled webhook and queue a follow-up after a configurable delay (stored in Prisma). Merchants edit the request template and see a queue of pending and sent requests in a Polaris IndexTable. Provide a settings page for timing and a sent log. Scopes: read_orders, read_customers.",
  },
  {
    category: "Operations",
    label: "Fulfillment board",
    tagline: "A kanban for orders that need action.",
    signature: "Move orders across unfulfilled → packed → shipped.",
    screens: ["Board", "Order detail", "Filters"],
    accent: "#454F5B",
    emoji: "🚚",
    prompt:
      "A fulfillment kanban board. Read unfulfilled and partially-fulfilled orders via the Admin GraphQL API and group them into columns (Needs action, Packed, Shipped). Let merchants move an order and mark it packed (status stored in Prisma) or create a fulfillment via fulfillmentCreateV2. Polaris-based columns with order cards, a detail drawer, and filters by date and tag. Scopes: read_orders, write_orders, read_fulfillments, write_fulfillments.",
  },
];
