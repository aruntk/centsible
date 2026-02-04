interface ElectronAPI {
  platform: string;
  checkForUpdates: () => Promise<{ success: boolean; updateInfo?: unknown; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: unknown) => void) => void;
  onUpdateNotAvailable: (callback: () => void) => void;
  onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void;
  onUpdateDownloaded: (callback: (info: unknown) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  removeUpdateListeners: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
