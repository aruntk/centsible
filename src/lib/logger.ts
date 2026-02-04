/**
 * Logging utility for capturing frontend and backend logs.
 * Works on both Electron and Capacitor (Android/iOS).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  timestamp: Date;
  level: LogLevel;
  source: "frontend" | "backend" | "network";
  message: string;
  data?: unknown;
}

const MAX_LOGS = 500;
let logs: LogEntry[] = [];
let nextId = 1;
let listeners: Set<() => void> = new Set();

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function addLog(level: LogLevel, source: LogEntry["source"], message: string, data?: unknown) {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: new Date(),
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

  // Notify listeners
  listeners.forEach((cb) => cb());
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

/**
 * Initialize the logger by intercepting console methods.
 * Call this once at app startup.
 */
export function initLogger() {
  if (typeof window === "undefined") return;

  // Only initialize once
  if ((window as unknown as { __loggerInitialized?: boolean }).__loggerInitialized) return;
  (window as unknown as { __loggerInitialized?: boolean }).__loggerInitialized = true;

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    addLog("info", "frontend", formatArgs(args));
  };

  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    addLog("info", "frontend", formatArgs(args));
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    addLog("warn", "frontend", formatArgs(args));
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    addLog("error", "frontend", formatArgs(args));
  };

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    addLog("debug", "frontend", formatArgs(args));
  };

  // Capture unhandled errors
  window.addEventListener("error", (event) => {
    addLog("error", "frontend", `Uncaught: ${event.message}`, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason instanceof Error
      ? `${event.reason.name}: ${event.reason.message}`
      : String(event.reason);
    addLog("error", "frontend", `Unhandled Promise: ${reason}`);
  });

  addLog("info", "frontend", "Logger initialized");
}

/**
 * Log a message directly (for backend/API responses).
 */
export function log(level: LogLevel, source: LogEntry["source"], message: string, data?: unknown) {
  addLog(level, source, message, data);

  // Also log to original console
  const consoleFn = originalConsole[level] || originalConsole.log;
  if (data) {
    consoleFn(`[${source}] ${message}`, data);
  } else {
    consoleFn(`[${source}] ${message}`);
  }
}

/**
 * Log a network request/response.
 */
export function logNetwork(method: string, url: string, status?: number, error?: string) {
  const message = error
    ? `${method} ${url} - ERROR: ${error}`
    : `${method} ${url} - ${status}`;
  addLog(error ? "error" : "info", "network", message);
}

/**
 * Get all logs.
 */
export function getLogs(): LogEntry[] {
  return [...logs];
}

/**
 * Get logs filtered by level.
 */
export function getLogsByLevel(levels: LogLevel[]): LogEntry[] {
  return logs.filter((l) => levels.includes(l.level));
}

/**
 * Clear all logs.
 */
export function clearLogs() {
  logs = [];
  nextId = 1;
  listeners.forEach((cb) => cb());
}

/**
 * Subscribe to log updates.
 */
export function subscribeLogs(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Create a fetch wrapper that logs network requests and backend errors.
 */
export function createLoggingFetch(originalFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || "GET";

    try {
      const response = await originalFetch(input, init);
      logNetwork(method, url, response.status);

      // For API calls, try to capture error responses as backend logs
      if (url.includes("/api/") && !response.ok) {
        // Clone the response so we can read it without consuming it
        const cloned = response.clone();
        try {
          const data = await cloned.json();
          if (data.error) {
            addLog("error", "backend", `${method} ${url}: ${data.error}`, data);
          }
        } catch {
          // Response wasn't JSON, try text
          try {
            const text = await response.clone().text();
            if (text && text.length < 500) {
              addLog("error", "backend", `${method} ${url}: ${text.slice(0, 200)}`);
            }
          } catch {
            // Ignore
          }
        }
      }

      return response;
    } catch (error) {
      logNetwork(method, url, undefined, error instanceof Error ? error.message : "Network error");
      throw error;
    }
  };
}
