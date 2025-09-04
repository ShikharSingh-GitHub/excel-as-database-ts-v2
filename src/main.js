// Try to load Electron APIs. When this file is required in a plain Node
// context (for diagnostics or tests) `require('electron')` may fail or be
// unavailable. Wrap in try/catch and leave variables undefined so the file
// can be safely required outside of Electron.
let app, BrowserWindow, ipcMain, dialog;
try {
  ({ app, BrowserWindow, ipcMain, dialog } = require("electron"));
} catch (e) {
  app = undefined;
  BrowserWindow = undefined;
  ipcMain = undefined;
  dialog = undefined;
}
const path = require("path");
const fs = require("fs");
const excelService = require("./electron/excelService");
const cleanXlsmService = require("./electron/cleanXlsmService");

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

// Only start the app when Electron's `app` is available. This prevents
// calling into Electron APIs when the module is loaded in plain Node.
if (app && typeof app.whenReady === "function") {
  app.whenReady().then(() => {
    createWindow();

    app.on("activate", function () {
      if (
        BrowserWindow &&
        BrowserWindow.getAllWindows &&
        BrowserWindow.getAllWindows().length === 0
      )
        createWindow();
    });
  });
} else {
  log("INFO", "Electron app API not available; skipping app startup");
}

if (app && typeof app.on === "function") {
  app.on("window-all-closed", function () {
    if (process.platform !== "darwin") app.quit();
  });
}

// Register IPC handlers only when ipcMain is available (i.e., running under
// Electron). This lets the file be required for static analysis or tests in
// plain Node without attempting to register IPC endpoints.
if (ipcMain) {
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
    try {
      return await cleanXlsmService.scanFolder(folderPath);
    } catch (e) {
      log("ERROR", "folder:scan failed", {
        folderPath,
        message: e.message,
      });
      return { error: "scan-failed", message: e.message };
    }
  });

  ipcMain.handle("workbook:meta", async (event, filePath) => {
    // Ensure fresh metadata: invalidate any caches and validate configured header rows
    try {
      if (excelService.invalidateCache) {
        try {
          excelService.invalidateCache(filePath);
        } catch (e) {}
      }
      log("INFO", "Getting workbook metadata with clean XLSM service", {
        filePath,
      });
      const meta = await cleanXlsmService.getWorkbookMeta(filePath);
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

  ipcMain.handle(
    "workbook:ensureDataSheet",
    async (event, filePath, sourceSheetName) => {
      try {
        return excelService.ensureDataSheetExists(filePath, sourceSheetName);
      } catch (e) {
        return { error: "ensure-failed", message: e.message };
      }
    }
  );

  ipcMain.handle("sort:get", async (event, filePath) => {
    return excelService.getSortState(filePath);
  });

  ipcMain.handle("sort:set", async (event, filePath, state) => {
    return excelService.setSortState(filePath, state);
  });

  ipcMain.handle("sheet:read", async (event, filePath, sheetName, opts) => {
    try {
      return await cleanXlsmService.readSheet(filePath, sheetName, opts || {});
    } catch (e) {
      log("ERROR", "sheet:read failed", {
        filePath,
        sheetName,
        message: e.message,
      });
      return { error: "read-failed", message: e.message };
    }
  });

  ipcMain.handle("sheet:create", async (event, filePath, sheetName, row) => {
    try {
      return await cleanXlsmService.createRow(filePath, sheetName, row);
    } catch (e) {
      log("ERROR", "sheet:create failed", {
        filePath,
        sheetName,
        message: e.message,
      });
      return { error: "create-failed", message: e.message };
    }
  });

  ipcMain.handle(
    "sheet:update",
    async (
      event,
      filePath,
      sheetName,
      pkValue,
      updates,
      expectedVersion,
      opts = {}
    ) => {
      try {
        const result = await cleanXlsmService.updateRow(
          filePath,
          sheetName,
          pkValue,
          updates,
          expectedVersion,
          opts
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
      try {
        return await cleanXlsmService.deleteRow(
          filePath,
          sheetName,
          pkValue,
          expectedVersion
        );
      } catch (e) {
        log("ERROR", "sheet:delete failed", {
          filePath,
          sheetName,
          pkValue,
          message: e.message,
        });
        return { error: "delete-failed", message: e.message };
      }
    }
  );

  ipcMain.handle("workbook:export", async (event, filePath) => {
    return excelService.exportWorkbook(filePath);
  });

  // Manual save: for XLSM files, working copy is automatically saved
  ipcMain.handle("workbook:save", async (event, filePath, opts = {}) => {
    try {
      return await cleanXlsmService.saveFile(filePath, opts);
    } catch (e) {
      log("ERROR", "workbook:save failed", {
        filePath,
        message: e.message,
      });
      return { error: "save-failed", message: e.message };
    }
  });

  ipcMain.handle("folder:refresh", async () => {
    return excelService.refreshFolder();
  });

  // Get XLSM notification status
  ipcMain.handle("xlsm:getNewFiles", async () => {
    try {
      return cleanXlsmService.getNewXlsmFiles();
    } catch (e) {
      log("ERROR", "xlsm:getNewFiles failed", { message: e.message });
      return [];
    }
  });

  // Clear XLSM notifications
  ipcMain.handle("xlsm:clearNotifications", async () => {
    try {
      cleanXlsmService.clearNotifications();
      return { success: true };
    } catch (e) {
      log("ERROR", "xlsm:clearNotifications failed", { message: e.message });
      return { success: false, error: e.message };
    }
  });

  // simple ping
  ipcMain.handle("ping", async () => "pong");

  // JSON operations
  ipcMain.handle("json:read", async (event, filePath) => {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      log("ERROR", "Failed to read JSON file", { filePath, error: e.message });
      return { error: true, message: e.message };
    }
  });

  ipcMain.handle("json:write", async (event, filePath, data) => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { success: true };
    } catch (e) {
      log("ERROR", "Failed to write JSON file", { filePath, error: e.message });
      return { error: true, message: e.message };
    }
  });

  ipcMain.handle("json:fetch", async (event, url, method = 'GET', payload = null) => {
    try {
      const { default: fetch } = await import("node-fetch");
      
      const options = {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (payload && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
        options.body = JSON.stringify(payload);
      }

      const response = await fetch(url, options);
      const data = await response.json();
      
      return { success: true, data };
    } catch (e) {
      log("ERROR", "Failed to fetch JSON from API", { url, method, error: e.message });
      return { error: true, message: e.message };
    }
  });

  ipcMain.handle("json:save", async (event, fileName, data) => {
    try {
      const config = excelService.readConfig();
      const folderPath = config.folderPath;
      
      if (!folderPath) {
        return { error: true, message: "No folder selected" };
      }

      const filePath = path.join(folderPath, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      // Refresh the folder to include the new file
      await cleanXlsmService.scanFolder(folderPath);
      
      return { success: true, filePath };
    } catch (e) {
      log("ERROR", "Failed to save JSON file", { fileName, error: e.message });
      return { error: true, message: e.message };
    }
  });

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
} else {
  log("INFO", "ipcMain not available; skipping IPC handler registration");
}
