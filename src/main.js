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
const fs = require("fs").promises;
const fsSync = require("fs");
const excelService = require("./electron/excelService");
const cleanXlsmService = require("./electron/cleanXlsmService");
const jsonService = require("./electron/jsonService");
const collectionStore = require("./electron/collectionStore");
const normalizationService = require("./electron/normalizationService");

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
  if (fsSync.existsSync(builtIndex)) {
    log("INFO", "Loading production renderer from dist", { path: builtIndex });
    mainWindow.loadFile(builtIndex);
  } else {
    const indexHtml = path.join(__dirname, "renderer", "index.html");
    if (fsSync.existsSync(indexHtml)) {
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

  // JSON file handlers
  ipcMain.handle(
    "json:fetch",
    async (
      event,
      url,
      fileName,
      displayName,
      method = "GET",
      payload = null,
      headers = {}
    ) => {
      try {
        return await jsonService.fetchAndSaveJson(
          url,
          fileName,
          displayName,
          method,
          payload,
          headers
        );
      } catch (e) {
        log("ERROR", "json:fetch failed", {
          url,
          fileName,
          method,
          message: e.message,
        });
        return { error: "fetch-failed", message: e.message };
      }
    }
  );

  ipcMain.handle("json:read", async (event, filePath, opts) => {
    try {
      return await jsonService.readJsonFile(filePath, opts || {});
    } catch (e) {
      log("ERROR", "json:read failed", { filePath, message: e.message });
      return { error: "read-failed", message: e.message };
    }
  });

  ipcMain.handle("json:meta", async (event, filePath) => {
    try {
      return await jsonService.getJsonMeta(filePath);
    } catch (e) {
      log("ERROR", "json:meta failed", { filePath, message: e.message });
      return { error: "meta-failed", message: e.message };
    }
  });

  ipcMain.handle("json:create", async (event, filePath, rowData) => {
    try {
      return await jsonService.createRow(filePath, rowData);
    } catch (e) {
      log("ERROR", "json:create failed", { filePath, message: e.message });
      return { error: "create-failed", message: e.message };
    }
  });

  ipcMain.handle("json:update", async (event, filePath, rowNumber, updates) => {
    try {
      return await jsonService.updateRow(filePath, rowNumber, updates);
    } catch (e) {
      log("ERROR", "json:update failed", {
        filePath,
        rowNumber,
        message: e.message,
      });
      return { error: "update-failed", message: e.message };
    }
  });

  ipcMain.handle("json:delete", async (event, filePath, rowNumber) => {
    try {
      return await jsonService.deleteRow(filePath, rowNumber);
    } catch (e) {
      log("ERROR", "json:delete failed", {
        filePath,
        rowNumber,
        message: e.message,
      });
      return { error: "delete-failed", message: e.message };
    }
  });

  ipcMain.handle("json:validate", async (event, filePath) => {
    try {
      return await jsonService.validateJsonFile(filePath);
    } catch (e) {
      log("ERROR", "json:validate failed", { filePath, message: e.message });
      return { error: "validate-failed", message: e.message };
    }
  });

  // JSON column configuration handlers
  ipcMain.handle("json:getProfile", async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const jsonData = JSON.parse(content);
      return await jsonService.getDatasetProfile(filePath, jsonData);
    } catch (e) {
      log("ERROR", "json:getProfile failed", { filePath, message: e.message });
      return { error: "profile-failed", message: e.message };
    }
  });

  ipcMain.handle(
    "json:updateColumnConfig",
    async (event, filePath, columnPath, config) => {
      try {
        return await jsonService.updateColumnConfig(
          filePath,
          columnPath,
          config
        );
      } catch (e) {
        log("ERROR", "json:updateColumnConfig failed", {
          filePath,
          columnPath,
          message: e.message,
        });
        return { error: "config-failed", message: e.message };
      }
    }
  );

  ipcMain.handle(
    "json:updateChildTableConfig",
    async (event, filePath, childPath, config) => {
      try {
        return await jsonService.updateChildTableConfig(
          filePath,
          childPath,
          config
        );
      } catch (e) {
        log("ERROR", "json:updateChildTableConfig failed", {
          filePath,
          childPath,
          message: e.message,
        });
        return { error: "child-config-failed", message: e.message };
      }
    }
  );

  // Collection-based CRUD handlers
  ipcMain.handle("collection:list", async (event, args) => {
    try {
      return await collectionStore.listRows(args);
    } catch (e) {
      log("ERROR", "collection:list failed", {
        collection: args.collection,
        message: e.message,
      });
      return { error: "list-failed", message: e.message };
    }
  });

  ipcMain.handle("collection:create", async (event, args) => {
    try {
      return await collectionStore.createRow(args);
    } catch (e) {
      log("ERROR", "collection:create failed", {
        collection: args.collection,
        message: e.message,
      });
      return { error: "create-failed", message: e.message };
    }
  });

  ipcMain.handle("collection:update", async (event, args) => {
    try {
      return await collectionStore.updateRow(args);
    } catch (e) {
      log("ERROR", "collection:update failed", {
        collection: args.collection,
        id: args.id,
        message: e.message,
      });
      return { error: "update-failed", message: e.message };
    }
  });

  ipcMain.handle("collection:delete", async (event, args) => {
    try {
      return await collectionStore.deleteRow(args);
    } catch (e) {
      log("ERROR", "collection:delete failed", {
        collection: args.collection,
        id: args.id,
        message: e.message,
      });
      return { error: "delete-failed", message: e.message };
    }
  });

  ipcMain.handle("collection:meta", async (event, collectionName) => {
    try {
      return await collectionStore.getCollectionMeta(collectionName);
    } catch (e) {
      log("ERROR", "collection:meta failed", {
        collection: collectionName,
        message: e.message,
      });
      return { error: "meta-failed", message: e.message };
    }
  });

  // Normalization handlers
  ipcMain.handle("normalize:json", async (event, jsonData, datasetName) => {
    try {
      return await normalizationService.normalizeJsonData(
        jsonData,
        datasetName
      );
    } catch (e) {
      log("ERROR", "normalize:json failed", {
        datasetName,
        message: e.message,
      });
      return { error: "normalize-failed", message: e.message };
    }
  });

  ipcMain.handle("normalize:recompose", async (event, collections) => {
    try {
      return await normalizationService.recomposeJsonData(collections);
    } catch (e) {
      log("ERROR", "normalize:recompose failed", {
        message: e.message,
      });
      return { error: "recompose-failed", message: e.message };
    }
  });

  ipcMain.handle("normalize:hasCollections", async (event, datasetName) => {
    try {
      return await normalizationService.hasCollections(datasetName);
    } catch (e) {
      log("ERROR", "normalize:hasCollections failed", {
        datasetName,
        message: e.message,
      });
      return { error: "check-failed", message: e.message };
    }
  });

  // JSON export handler
  ipcMain.handle("json:export", async (event, fileName, exportPath) => {
    try {
      // Get all collections for this dataset
      const expectedCollections = [
        "pages",
        "page_elements",
        "testsets",
        "testcases",
        "steps",
        "application",
      ];

      const collections = {};
      for (const collectionName of expectedCollections) {
        try {
          const data = await collectionStore.listRows({ collection: collectionName });
          if (data.length > 0) {
            collections[collectionName] = data;
          }
        } catch (e) {
          // Collection might not exist, continue
        }
      }

      // Recompose to JSON format
      const recomposedJson = await normalizationService.recomposeJsonData(collections);

      // Write to export path
      const fs = require("fs").promises;
      await fs.writeFile(exportPath, JSON.stringify(recomposedJson, null, 2));

      log("INFO", "JSON exported successfully", {
        fileName,
        exportPath,
        collections: Object.keys(collections),
      });

      return { success: true, path: exportPath };
    } catch (e) {
      log("ERROR", "json:export failed", {
        fileName,
        exportPath,
        message: e.message,
      });
      return { error: "export-failed", message: e.message };
    }
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
} else {
  log("INFO", "ipcMain not available; skipping IPC handler registration");
}
