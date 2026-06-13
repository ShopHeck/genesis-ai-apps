import { describe, it, expect } from "vitest";
import {
  validateShopDomain, generateNonce, timingSafeEqual,
  canonicalMessage, verifyHmac, buildInstallUrl, searchParamsToObject,
} from "./shopify-oauth";

describe("validateShopDomain", () => {
  it("accepts well-formed myshopify domains", () => {
    expect(validateShopDomain("acme.myshopify.com")).toBe(true);
    expect(validateShopDomain("acme-store-2.myshopify.com")).toBe(true);
  });
  it("rejects spoofed or malformed domains", () => {
    expect(validateShopDomain("acme.myshopify.com.evil.com")).toBe(false);
    expect(validateShopDomain("evil.com")).toBe(false);
    expect(validateShopDomain("acme.myshopify.io")).toBe(false);
    expect(validateShopDomain("-acme.myshopify.com")).toBe(false);
    expect(validateShopDomain(123)).toBe(false);
    expect(validateShopDomain("")).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("compares correctly", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("generateNonce", () => {
  it("is 32 hex chars and unique", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("canonicalMessage", () => {
  it("sorts params and drops hmac/signature", () => {
    const msg = canonicalMessage({ shop: "x.myshopify.com", code: "abc", hmac: "zz", signature: "qq", state: "n1" });
    expect(msg).toBe("code=abc&shop=x.myshopify.com&state=n1");
  });
});

describe("verifyHmac", () => {
  const secret = "hush";
  it("accepts a correctly-signed callback and rejects tampering", async () => {
    // Compute the expected hmac the same way the verifier does.
    const params: Record<string, string> = { shop: "acme.myshopify.com", code: "thecode", state: "nonce123" };
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalMessage(params)));
    const hmac = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

    expect(await verifyHmac({ ...params, hmac }, secret)).toBe(true);
    expect(await verifyHmac({ ...params, hmac, code: "tampered" }, secret)).toBe(false);
    expect(await verifyHmac({ ...params, hmac: "deadbeef" }, secret)).toBe(false);
    expect(await verifyHmac(params, secret)).toBe(false); // missing hmac
  });
});

describe("buildInstallUrl", () => {
  it("builds the authorize URL with all params", () => {
    const u = new URL(buildInstallUrl({
      shop: "acme.myshopify.com", apiKey: "key123", scopes: ["read_products", "write_products"],
      redirectUri: "https://app.example/cb", state: "n1",
    }));
    expect(u.origin + u.pathname).toBe("https://acme.myshopify.com/admin/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("key123");
    expect(u.searchParams.get("scope")).toBe("read_products,write_products");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.example/cb");
    expect(u.searchParams.get("state")).toBe("n1");
  });
});

describe("searchParamsToObject", () => {
  it("flattens query params", () => {
    expect(searchParamsToObject(new URL("https://x/cb?a=1&b=2"))).toEqual({ a: "1", b: "2" });
  });
});
