/**
 * Platform detection utilities for cross-platform support.
 * Detects Electron (desktop) vs Capacitor (mobile) vs Web (browser).
 */

export type Platform = "electron" | "capacitor" | "web";

export function getPlatform(): Platform {
  if (typeof window === "undefined") {
    // Server-side (Node.js) - likely Electron main process
    return "electron";
  }

  // Check for Capacitor
  if (
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Capacitor?.isNativePlatform?.()
  ) {
    return "capacitor";
  }

  // Check for Electron renderer
  if (typeof window !== "undefined" && window.electronAPI) {
    return "electron";
  }

  return "web";
}

export function isCapacitor(): boolean {
  return getPlatform() === "capacitor";
}

export function isElectron(): boolean {
  return getPlatform() === "electron";
}

export function isWeb(): boolean {
  return getPlatform() === "web";
}

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capacitor = (window as any).Capacitor;
  if (capacitor?.isNativePlatform?.()) {
    const platform = capacitor.getPlatform?.();
    return platform === "android" || platform === "ios";
  }

  return false;
}

export function getCapacitorPlatform(): "android" | "ios" | "web" | null {
  if (typeof window === "undefined") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capacitor = (window as any).Capacitor;
  if (capacitor?.getPlatform) {
    return capacitor.getPlatform() as "android" | "ios" | "web";
  }

  return null;
}
