"use client";

import { useEffect } from "react";
import { initLogger, log, createLoggingFetch } from "@/lib/logger";

export default function LoggerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize console interception
    initLogger();

    // Wrap fetch to log network requests
    const originalFetch = window.fetch.bind(window);
    window.fetch = createLoggingFetch(originalFetch);

    // Log app start
    log("info", "frontend", "App initialized");

    return () => {
      // Restore original fetch on cleanup
      window.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
}
