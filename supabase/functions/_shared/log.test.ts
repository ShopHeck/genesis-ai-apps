import { describe, it, expect, vi } from "vitest";
import { formatLog, newRequestId, createLogger } from "./log";

describe("formatLog", () => {
  it("emits a single JSON line with the core fields", () => {
    const line = formatLog({ level: "info", ts: "2026-06-13T00:00:00Z", fn: "gen", requestId: "r1", msg: "start", provider: "gemini" });
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: "info", fn: "gen", requestId: "r1", msg: "start", provider: "gemini" });
  });
});

describe("newRequestId", () => {
  it("produces unique non-empty ids", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });
});

describe("createLogger", () => {
  it("writes structured JSON to the right console channel", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createLogger("gen", "req-123");
    log.info("hello", { a: 1 });
    log.error("boom");
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({ level: "info", fn: "gen", requestId: "req-123", msg: "hello", a: 1 });
    expect(JSON.parse(errorSpy.mock.calls[0][0] as string)).toMatchObject({ level: "error", msg: "boom" });
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
