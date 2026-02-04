"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Trash2, Download, Filter, RefreshCw } from "lucide-react";
import {
  initLogger,
  getLogs,
  clearLogs,
  subscribeLogs,
  LogEntry,
  LogLevel,
} from "@/lib/logger";
import { isCapacitor } from "@/lib/platform";

interface BackendLogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "text-gray-500 dark:text-gray-400",
  info: "text-blue-600 dark:text-blue-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

const LEVEL_BG: Record<LogLevel, string> = {
  debug: "bg-gray-100 dark:bg-gray-800",
  info: "bg-blue-50 dark:bg-blue-900/30",
  warn: "bg-amber-50 dark:bg-amber-900/30",
  error: "bg-red-50 dark:bg-red-900/30",
};

const SOURCE_COLORS: Record<string, string> = {
  frontend: "text-purple-600 dark:text-purple-400",
  backend: "text-green-600 dark:text-green-400",
  network: "text-cyan-600 dark:text-cyan-400",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [backendLogs, setBackendLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastBackendLogId = useRef<number>(0);

  const fetchBackendLogs = useCallback(async () => {
    // Skip on mobile - no server-side API
    if (isCapacitor()) return;

    try {
      const res = await fetch(`/api/logs?since=${lastBackendLogId.current}`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs && data.logs.length > 0) {
          const newLogs: LogEntry[] = data.logs.map((log: BackendLogEntry) => ({
            id: log.id + 100000, // Offset to avoid ID collision with frontend logs
            timestamp: new Date(log.timestamp),
            level: log.level,
            source: "backend" as const,
            message: `[${log.source}] ${log.message}`,
            data: log.data,
          }));
          lastBackendLogId.current = Math.max(
            ...data.logs.map((l: BackendLogEntry) => l.id)
          );
          setBackendLogs((prev) => [...prev, ...newLogs]);
        }
      }
    } catch {
      // Silently fail - might be on mobile or server not running
    }
  }, []);

  useEffect(() => {
    initLogger();
    setLogs(getLogs());

    const unsubscribe = subscribeLogs(() => {
      setLogs(getLogs());
    });

    // Fetch backend logs initially
    fetchBackendLogs();

    // Poll for backend logs every 2 seconds
    const interval = setInterval(fetchBackendLogs, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [fetchBackendLogs]);

  // Combine frontend and backend logs, sorted by timestamp
  const allLogs = [...logs, ...backendLogs].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allLogs, autoScroll]);

  const filteredLogs = allLogs.filter((log) => {
    if (filter !== "all" && log.level !== filter) return false;
    if (sourceFilter !== "all" && log.source !== sourceFilter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleClear = async () => {
    clearLogs();
    setLogs([]);
    setBackendLogs([]);
    lastBackendLogId.current = 0;
    // Clear backend logs too
    if (!isCapacitor()) {
      try {
        await fetch("/api/logs", { method: "DELETE" });
      } catch {
        // Ignore errors
      }
    }
  };

  const handleExport = () => {
    const content = filteredLogs
      .map(
        (log) =>
          `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}${
            log.data ? "\n  " + JSON.stringify(log.data) : ""
          }`
      )
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `centsible-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          Logs
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1 border dark:border-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 p-2 sm:p-3">
        <Filter className="w-4 h-4 text-gray-400" />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as LogLevel | "all")}
          className="border dark:border-gray-700 rounded px-2 py-1 text-xs sm:text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border dark:border-gray-700 rounded px-2 py-1 text-xs sm:text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">All Sources</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="network">Network</option>
        </select>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="flex-1 min-w-[120px] border dark:border-gray-700 rounded px-2 py-1 text-xs sm:text-sm bg-white dark:bg-gray-800 dark:text-gray-200"
        />

        <label className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
          />
          <RefreshCw className="w-3 h-3" />
          <span className="hidden sm:inline">Auto-scroll</span>
        </label>

        <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
          {filteredLogs.length} / {allLogs.length}
        </span>
      </div>

      {/* Logs List */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden">
        <div className="h-full overflow-auto font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No logs to display
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-800">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`px-2 sm:px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${LEVEL_BG[log.level]}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 shrink-0 tabular-nums">
                      {formatTime(log.timestamp)}
                    </span>
                    <span
                      className={`uppercase font-semibold w-12 shrink-0 ${LEVEL_COLORS[log.level]}`}
                    >
                      {log.level}
                    </span>
                    <span
                      className={`w-16 shrink-0 ${SOURCE_COLORS[log.source]}`}
                    >
                      [{log.source}]
                    </span>
                    <span className="text-gray-800 dark:text-gray-200 break-all">
                      {log.message}
                    </span>
                  </div>
                  {log.data !== undefined && (
                    <pre className="mt-1 ml-[7.5rem] text-gray-500 dark:text-gray-400 text-[10px] overflow-x-auto">
                      {typeof log.data === "string" ? log.data : JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
