import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { createServer } from "http";
import { fork, ChildProcess } from "child_process";
import { autoUpdater } from "electron-updater";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isPacked = app.isPackaged;

function getResourcePath(...parts: string[]): string {
  if (isPacked) {
    return path.join(process.resourcesPath, ...parts);
  }
  // In dev, standalone is at <project>/.next/standalone
  return path.join(__dirname, "..", ".next", ...parts);
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        srv.close(() => resolve(addr.port));
      } else {
        reject(new Error("Could not get free port"));
      }
    });
  });
}

function startNextServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverJs = getResourcePath("standalone", "server.js");

    const dbPath = path.join(app.getPath("userData"), "fin-tracker.db");

    serverProcess = fork(serverJs, [], {
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: "localhost",
        NODE_ENV: "production",
        FINTRACKER_DB_PATH: dbPath,
      },
      cwd: getResourcePath("standalone"),
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    // Log server output for debugging
    serverProcess.stdout?.on("data", (data) => {
      console.log(`[Server]: ${data}`);
    });
    serverProcess.stderr?.on("data", (data) => {
      console.error(`[Server Error]: ${data}`);
    });

    // Wait for server to be ready by polling
    const maxAttempts = 50;
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = require("http").get(`http://localhost:${port}`, () => {
        resolve();
      });
      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error("Next.js server failed to start"));
        } else {
          setTimeout(check, 200);
        }
      });
    };
    setTimeout(check, 500);

    serverProcess.on("error", reject);
    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Next.js server exited with code ${code}`);
      }
    });
  });
}

function createWindow(port: number) {
  const iconPath = isPacked
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "..", "public", "logo.png");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    title: "Centsible",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

let appPort: number;

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null && appPort) {
    createWindow(appPort);
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.whenReady().then(async () => {
  try {
    appPort = await getFreePort();
    await startNextServer(appPort);
    createWindow(appPort);
    setupAutoUpdater();
  } catch (err) {
    console.error("Failed to start:", err);
    app.quit();
  }
});

// Auto-updater setup
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("update-available", info);
  });

  autoUpdater.on("update-not-available", () => {
    mainWindow?.webContents.send("update-not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents.send("update-download-progress", progress);
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("update-downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    mainWindow?.webContents.send("update-error", err.message);
  });
}

// IPC handlers for update actions
ipcMain.handle("check-for-updates", async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle("download-update", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
});

ipcMain.handle("install-update", () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle("get-platform", () => {
  return process.platform;
});
