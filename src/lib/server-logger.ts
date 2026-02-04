/**
 * Server-side logging utility for API routes.
 * Stores logs in memory and exposes them via API.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ServerLogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

const MAX_LOGS = 200;
let logs: ServerLogEntry[] = [];
let nextId = 1;

export function serverLog(
  level: LogLevel,
  source: string,
  message: string,
  data?: unknown
) {
  const entry: ServerLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    data,
  };

  logs.push(entry);

  // Trim old logs if over limit
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }

  // Also log to console for debugging
  const prefix = `[${level.toUpperCase()}] [${source}]`;
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

export function getServerLogs(sinceId?: number): ServerLogEntry[] {
  if (sinceId !== undefined) {
    return logs.filter((l) => l.id > sinceId);
  }
  return [...logs];
}

export function clearServerLogs() {
  logs = [];
  nextId = 1;
}

// Convenience methods
export const logger = {
  debug: (source: string, message: string, data?: unknown) =>
    serverLog("debug", source, message, data),
  info: (source: string, message: string, data?: unknown) =>
    serverLog("info", source, message, data),
  warn: (source: string, message: string, data?: unknown) =>
    serverLog("warn", source, message, data),
  error: (source: string, message: string, data?: unknown) =>
    serverLog("error", source, message, data),
};
