// Minimal structured logging for edge functions: one JSON line per event with a
// stable request id, so logs are greppable/aggregatable instead of ad-hoc
// console.error strings. Pure formatting is unit-tested.

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  ts: string;
  fn: string;
  requestId: string;
  msg: string;
  [key: string]: unknown;
}

export function newRequestId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

export interface Logger {
  requestId: string;
  info: (msg: string, extra?: Record<string, unknown>) => void;
  warn: (msg: string, extra?: Record<string, unknown>) => void;
  error: (msg: string, extra?: Record<string, unknown>) => void;
}

export function createLogger(fn: string, requestId: string = newRequestId()): Logger {
  const emit = (level: LogLevel, msg: string, extra?: Record<string, unknown>) => {
    const line = formatLog({ level, ts: new Date().toISOString(), fn, requestId, msg, ...(extra ?? {}) });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    requestId,
    info: (m, e) => emit("info", m, e),
    warn: (m, e) => emit("warn", m, e),
    error: (m, e) => emit("error", m, e),
  };
}
