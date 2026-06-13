import { describe, it, expect } from "vitest";
import { ADMIN_OPERATIONS, ADMIN_OPERATION_MENU, getValidatedOperations } from "./graphql-operations";

describe("ADMIN_OPERATIONS catalog", () => {
  it("every entry is a well-formed, scoped operation", () => {
    for (const op of ADMIN_OPERATIONS) {
      expect(op.id).toBeTruthy();
      expect(op.rootField).toBeTruthy();
      expect(["query", "mutation"]).toContain(op.type);
      expect(op.scopes.length).toBeGreaterThan(0);
      expect(op.graphql).toContain("#graphql");
      expect(op.graphql).toContain(op.rootField);
    }
  });

  it("every mutation surfaces userErrors", () => {
    for (const op of ADMIN_OPERATIONS.filter((o) => o.type === "mutation")) {
      expect(op.graphql, `${op.id} should select userErrors`).toContain("userErrors");
    }
  });

  it("ids are unique", () => {
    const ids = ADMIN_OPERATIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("menu lists every operation", () => {
    for (const op of ADMIN_OPERATIONS) {
      expect(ADMIN_OPERATION_MENU).toContain(op.rootField);
    }
  });
});

describe("getValidatedOperations", () => {
  it("resolves by root field and unions scopes", () => {
    const { snippets, scopes } = getValidatedOperations(["products", "productVariantsBulkUpdate"]);
    expect(snippets).toContain("VALIDATED ADMIN GRAPHQL OPERATIONS");
    expect(snippets).toContain("query Products");
    expect(snippets).toContain("mutation BulkUpdateVariants");
    expect(scopes).toContain("read_products");
    expect(scopes).toContain("write_products");
    // unioned + de-duped
    expect(scopes.filter((s) => s === "read_products").length).toBe(1);
  });

  it("resolves by operation id too", () => {
    const { snippets } = getValidatedOperations(["orders_list"]);
    expect(snippets).toContain("query Orders");
  });

  it("is case-insensitive on root field and dedupes repeats", () => {
    const { snippets } = getValidatedOperations(["PRODUCTS", "products"]);
    expect(snippets.match(/query Products/g)?.length).toBe(1);
  });

  it("returns empty for unknown or no choices", () => {
    expect(getValidatedOperations([]).snippets).toBe("");
    expect(getValidatedOperations(["nonexistentField"]).snippets).toBe("");
    expect(getValidatedOperations(["nonexistentField"]).scopes).toEqual([]);
  });
});
