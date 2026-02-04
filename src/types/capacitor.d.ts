/**
 * Type definitions for Capacitor platform detection.
 */

interface CapacitorGlobal {
  isNativePlatform(): boolean;
  getPlatform(): "android" | "ios" | "web";
  isPluginAvailable(name: string): boolean;
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

export {};
