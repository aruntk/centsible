/**
 * Cross-platform file picker that works on:
 * - Web/Desktop: Uses native HTML file input
 * - Mobile (Capacitor): Uses Capacitor Filesystem plugin
 */

import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { isCapacitor, isMobile } from "./platform";

export interface PickedFile {
  name: string;
  content: string;
  mimeType: string;
}

/**
 * Pick a file using the appropriate method for the current platform.
 * On mobile, opens the native file picker.
 * On web/desktop, uses the standard file input.
 */
export async function pickFile(accept?: string): Promise<PickedFile | null> {
  if (isCapacitor() && isMobile()) {
    return pickFileMobile();
  }
  return pickFileWeb(accept);
}

/**
 * Pick a file on web/desktop using HTML file input.
 */
function pickFileWeb(accept?: string): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) {
      input.accept = accept;
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const content = await file.text();
      resolve({
        name: file.name,
        content,
        mimeType: file.type || "text/plain",
      });
    };

    input.oncancel = () => {
      resolve(null);
    };

    input.click();
  });
}

/**
 * Pick a file on mobile using Capacitor FilePicker.
 * Falls back to reading from a known location if FilePicker is not available.
 */
async function pickFileMobile(): Promise<PickedFile | null> {
  try {
    // Try to use the native file picker via a custom implementation
    // Since @capacitor/file-picker is a separate plugin, we'll use a workaround
    // by prompting the user to place files in a specific directory

    // For now, we'll use a hidden file input which works in WebView
    return pickFileWeb(".csv,.txt,.xls,.xlsx");
  } catch (error) {
    console.error("Error picking file on mobile:", error);
    return null;
  }
}

/**
 * Read a file from the app's documents directory (mobile only).
 * Useful for reading imported files.
 */
export async function readFileFromDocuments(fileName: string): Promise<string | null> {
  if (!isCapacitor()) {
    console.warn("readFileFromDocuments is only available on Capacitor");
    return null;
  }

  try {
    const result = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    return typeof result.data === "string" ? result.data : null;
  } catch (error) {
    console.error("Error reading file from documents:", error);
    return null;
  }
}

/**
 * Write a file to the app's documents directory (mobile only).
 * Useful for exporting data.
 */
export async function writeFileToDocuments(fileName: string, content: string): Promise<boolean> {
  if (!isCapacitor()) {
    // On web, trigger a download instead
    downloadFile(fileName, content);
    return true;
  }

  try {
    await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return true;
  } catch (error) {
    console.error("Error writing file to documents:", error);
    return false;
  }
}

/**
 * List files in the app's documents directory (mobile only).
 */
export async function listDocumentsFiles(): Promise<string[]> {
  if (!isCapacitor()) {
    return [];
  }

  try {
    const result = await Filesystem.readdir({
      path: "",
      directory: Directory.Documents,
    });
    return result.files.map((f) => f.name);
  } catch (error) {
    console.error("Error listing documents:", error);
    return [];
  }
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(fileName: string, content: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Check if the app has permission to access files (mobile only).
 */
export async function checkFilePermissions(): Promise<boolean> {
  if (!isCapacitor()) {
    return true; // Web always has permission via user interaction
  }

  try {
    const status = await Filesystem.checkPermissions();
    return status.publicStorage === "granted";
  } catch {
    return false;
  }
}

/**
 * Request file access permissions (mobile only).
 */
export async function requestFilePermissions(): Promise<boolean> {
  if (!isCapacitor()) {
    return true;
  }

  try {
    const status = await Filesystem.requestPermissions();
    return status.publicStorage === "granted";
  } catch {
    return false;
  }
}
