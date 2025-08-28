const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const excelService = require("./electron/excelService");

// Simple logging function for main process
function log(level, message, ctx) {
  try {
    const ts = new Date().toISOString();
    const line =
      `${ts} [${level}] ${message}` + (ctx ? " " + JSON.stringify(ctx) : "");
    console.log(line);
  } catch (e) {
    console.error("Logging error:", e);
  }
}

let mainWindow;

// Function to check if Vite dev server is ready
async function waitForViteServer(url, maxAttempts = 30) {
  const { default: fetch } = await import("node-fetch");

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log("INFO", "Vite dev server is ready", { url });
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }

    // Wait 1 second before next attempt
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  log("WARN", "Vite dev server did not become ready in time", {
    url,
    maxAttempts,
  });
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In dev, we expect the Vite renderer dev server to run and provide RENDERER_DEV_URL
  const devUrl =
    process.env.RENDERER_DEV_URL || process.env.VITE_DEV_SERVER_URL || null;

  if (devUrl) {
    log("INFO", "Waiting for Vite dev server to be ready...", { devUrl });

    // Wait for Vite server to be ready before loading
    waitForViteServer(devUrl).then((isReady) => {
      if (isReady) {
        log("INFO", "Loading renderer from dev server", { devUrl });
        mainWindow.loadURL(devUrl);
      } else {
        log(
          "ERROR",
          "Failed to load from dev server, falling back to production build"
        );
        loadProductionRenderer();
      }
    });
  } else {
    // Production: load the built renderer from the packaged app
    loadProductionRenderer();
  }
}

function loadProductionRenderer() {
  // prefer src/renderer-app/dist/index.html if present, otherwise fall back to legacy renderer/index.html
  const builtIndex = path.join(__dirname, "renderer-app", "dist", "index.html");
  if (fs.existsSync(builtIndex)) {
    log("INFO", "Loading production renderer from dist", { path: builtIndex });
    mainWindow.loadFile(builtIndex);
  } else {
    const indexHtml = path.join(__dirname, "renderer", "index.html");
    if (fs.existsSync(indexHtml)) {
      log("INFO", "Loading legacy renderer", { path: indexHtml });
      mainWindow.loadFile(indexHtml);
    } else {
      log("ERROR", "No renderer found, showing error page");
      mainWindow.loadURL(
        "data:text/html,<h1>No renderer found</h1><p>Please build the renderer app first.</p>"
      );
    }
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// IPC handlers
ipcMain.handle("config:get", async () => {
  return excelService.readConfig();
});

ipcMain.handle("config:set", async (event, partial) => {
  return excelService.writeConfig(partial);
});

ipcMain.handle("config:getValue", async (event, key, defaultValue) => {
  return excelService.getConfigValue(key, defaultValue);
});

ipcMain.handle("config:addRecentWorkbook", async (event, filePath) => {
  return excelService.addRecentWorkbook(filePath);
});

ipcMain.handle("config:getRecentWorkbooks", async () => {
  return excelService.getRecentWorkbooks();
});

ipcMain.handle("config:isSheetReadOnly", async (event, sheetName) => {
  return excelService.isSheetReadOnly(sheetName);
});

ipcMain.handle("folder:pick", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (res.canceled) return null;
  return res.filePaths[0];
});

ipcMain.handle("folder:scan", async (event, folderPath) => {
  return excelService.scanFolder(folderPath);
});

ipcMain.handle("workbook:meta", async (event, filePath) => {
  // Ensure fresh metadata: invalidate any caches and validate configured header rows
  try {
    if (excelService.invalidateCache) {
      try {
        excelService.invalidateCache(filePath);
      } catch (e) {}
    }
    const meta = excelService.getWorkbookMeta(filePath);
    if (meta && meta.sheets && Array.isArray(meta.sheets)) {
      // Trigger a validation for any configured header rows (this will persist corrections)
      for (const s of meta.sheets) {
        try {
          // call exported helper to validate/persist
          if (excelService.getHeaderRowPosition) {
            excelService.getHeaderRowPosition(filePath, s.name);
          }
        } catch (e) {}
      }
      // re-read metadata to reflect any persisted corrections
      return excelService.getWorkbookMeta(filePath);
    }
    return meta;
  } catch (e) {
    return excelService.getWorkbookMeta(filePath);
  }
});

ipcMain.handle("sort:get", async (event, filePath) => {
  return excelService.getSortState(filePath);
});

ipcMain.handle("sort:set", async (event, filePath, state) => {
  return excelService.setSortState(filePath, state);
});

ipcMain.handle("sheet:read", async (event, filePath, sheetName, opts) => {
  return excelService.readSheet(filePath, sheetName, opts || {});
});

ipcMain.handle("sheet:create", async (event, filePath, sheetName, row) => {
  return excelService.createRow(filePath, sheetName, row);
});

ipcMain.handle(
  "sheet:update",
  async (event, filePath, sheetName, pkValue, updates, expectedVersion) => {
    try {
      const result = await excelService.updateRow(
        filePath,
        sheetName,
        pkValue,
        updates,
        expectedVersion
      );
      if (result.error === "version-conflict") {
        log("WARN", "Version conflict detected", {
          filePath,
          sheetName,
          pkValue,
          expectedVersion,
          currentVersion: result.current["_version"],
        });
      }
      return result;
    } catch (e) {
      log("ERROR", "sheet:update failed", {
        filePath,
        sheetName,
        message: e.message,
      });
      return { error: "update-failed", message: e.message };
    }
  }
);

ipcMain.handle(
  "sheet:delete",
  async (event, filePath, sheetName, pkValue, expectedVersion) => {
    return excelService.deleteRow(
      filePath,
      sheetName,
      pkValue,
      expectedVersion
    );
  }
);

ipcMain.handle("workbook:export", async (event, filePath) => {
  return excelService.exportWorkbook(filePath);
});

ipcMain.handle("folder:refresh", async () => {
  return excelService.refreshFolder();
});

// simple ping
ipcMain.handle("ping", async () => "pong");

// Listen for forwarded renderer console events
ipcMain.on("renderer:console", (event, payload) => {
  try {
    const { level, args } = payload || {};
    const msg = args && args.length ? args.map(String).join(" ") : "";
    log("RENDERER", msg || "(no message)");
  } catch (e) {
    console.error("Failed to log renderer console", e);
  }
});
