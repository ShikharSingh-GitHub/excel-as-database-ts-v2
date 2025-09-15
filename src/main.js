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
      const data = fs.readFileSync(filePath, "utf8");
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

  ipcMain.handle(
    "json:fetch",
    async (event, url, method = "GET", payload = null) => {
      try {
        const { default: fetch } = await import("node-fetch");

        const https = require("https");

        const options = {
          method: method.toUpperCase(),
          headers: {
            "Content-Type": "application/json",
          },
        };

        // Configure TLS handling:
        // - If NODE_EXTRA_CA_CERTS is set, use that CA bundle to validate certificates.
        // - If ALLOW_SELF_SIGNED=true is set (dev only) then allow self-signed certs (insecure).
        try {
          const parsed = new URL(url);
          if (parsed.protocol === "https:") {
            let agentOptions = {};

            if (process.env.NODE_EXTRA_CA_CERTS) {
              try {
                const caContent = fs.readFileSync(
                  process.env.NODE_EXTRA_CA_CERTS
                );
                agentOptions.ca = caContent;
              } catch (caErr) {
                log("WARN", "Failed to read NODE_EXTRA_CA_CERTS file", {
                  path: process.env.NODE_EXTRA_CA_CERTS,
                  error: caErr.message,
                });
              }
            }

            if (process.env.ALLOW_SELF_SIGNED === "true") {
              // Dev-only: allow self-signed certificates. Not recommended for production.
              agentOptions.rejectUnauthorized = false;
              log(
                "WARN",
                "ALLOW_SELF_SIGNED is enabled — TLS certificate verification disabled"
              );
            }

            // Create an https.Agent and pass it to node-fetch for TLS control
            options.agent = new https.Agent(agentOptions);
          }
        } catch (urlErr) {
          // If URL parsing fails, continue and let fetch report the error
        }

        if (
          payload &&
          (method.toUpperCase() === "POST" || method.toUpperCase() === "PUT")
        ) {
          options.body = JSON.stringify(payload);
        }

        const response = await fetch(url, options);

        // Check if the response was successful
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate that we got some data
        if (data === null || data === undefined) {
          throw new Error("API returned empty response");
        }

        return { success: true, data };
      } catch (e) {
        log("ERROR", "Failed to fetch JSON from API", {
          url,
          method,
          error: e.message,
        });
        return { error: true, message: e.message };
      }
    }
  );

  ipcMain.handle("json:save", async (event, arg1, arg2, arg3) => {
    try {
      let folderPath, fileName, data;

      // Support two calling conventions:
      // 1) json.save(folderPath, fileName, data)  <-- 3 args
      // 2) json.save(fileName, data)              <-- 2 args
      if (typeof arg3 !== "undefined") {
        // Called as (folderPath, fileName, data) - 3 args
        folderPath = arg1;
        fileName = arg2;
        data = arg3;
        log(
          "INFO",
          "json:save called with 3 args (folderPath, fileName, data)",
          { folderPath, fileName }
        );
      } else if (typeof arg2 !== "undefined") {
        // Called as (fileName, data) - 2 args
        fileName = arg1;
        data = arg2;

        // Default folder: use app documents folder when available, fallback to cwd
        try {
          folderPath =
            app && app.getPath ? app.getPath("documents") : process.cwd();
        } catch (e) {
          folderPath = process.cwd();
        }
        log("INFO", "json:save called with 2 args (fileName, data)", {
          fileName,
          folderPath,
        });
      } else {
        throw new Error(
          "Invalid arguments: expected (fileName, data) or (folderPath, fileName, data)"
        );
      }

      // Validate inputs
      if (!fileName || typeof fileName !== "string") {
        throw new Error("fileName must be a non-empty string");
      }

      if (!folderPath || typeof folderPath !== "string") {
        throw new Error("folderPath must be a non-empty string");
      }

      // Validate that we have data to save
      if (data === null || data === undefined) {
        throw new Error("No data provided to save");
      }

      // Ensure the folder exists, create it if it doesn't
      if (!fs.existsSync(folderPath)) {
        try {
          fs.mkdirSync(folderPath, { recursive: true });
          log("INFO", "Created folder path", { folderPath });
        } catch (e) {
          throw new Error(
            `Failed to create folder: ${folderPath} - ${e.message}`
          );
        }
      }

      // Check if folderPath is actually a directory
      const stat = fs.statSync(folderPath);
      if (!stat.isDirectory()) {
        throw new Error(`Path is not a directory: ${folderPath}`);
      }

      // Ensure fileName ends with .json
      const finalFileName = fileName.endsWith(".json")
        ? fileName
        : `${fileName}.json`;

      // Build full file path
      const filePath = path.join(folderPath, finalFileName);

      // Write the file with pretty formatting
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");

      log("INFO", "JSON file saved successfully", { filePath });
      return { success: true, filePath };
    } catch (e) {
      log("ERROR", "Failed to save JSON file", {
        error: e.message,
        args: {
          arg1:
            typeof arg1 === "string"
              ? `${arg1.substring(0, 50)}...`
              : typeof arg1,
          arg2:
            typeof arg2 === "string"
              ? `${arg2.substring(0, 50)}...`
              : typeof arg2,
          arg3: typeof arg3,
        },
      });
      return { error: true, message: e.message };
    }
  });

  // JSON CRUD operations
  ipcMain.handle(
    "json:updateScalar",
    async (event, filePath, path, newValue, oldValue) => {
      try {
        const abs = require("path").resolve(filePath);

        // Read current JSON
        const jsonData = JSON.parse(fs.readFileSync(abs, "utf8"));

        // Get current value at path for conflict detection
        const current = getAtPath(jsonData, path);
        if (
          typeof oldValue !== "undefined" &&
          JSON.stringify(current) !== JSON.stringify(oldValue)
        ) {
          return { conflict: true, current };
        }

        // Set new value
        setAtPath(jsonData, path, newValue);

        // Atomic write
        const tempPath = abs + ".tmp";
        fs.writeFileSync(tempPath, JSON.stringify(jsonData, null, 2));
        fs.renameSync(tempPath, abs);

        log("INFO", "JSON scalar updated", { filePath, path, newValue });
        return { success: true, message: "Value updated successfully" };
      } catch (e) {
        log("ERROR", "Failed to update JSON scalar", {
          filePath,
          path,
          error: e.message,
        });
        return { error: e.message };
      }
    }
  );

  ipcMain.handle(
    "json:updateFieldById",
    async (event, filePath, tablePath, id, field, newValue, oldValue) => {
      try {
        const abs = require("path").resolve(filePath);

        // Get schema to validate table is CRUD-enabled
        const schema = getJsonSchema(abs);
        const meta = schema.byPath[tablePath];
        if (!meta?.allowCrud) {
          throw new Error("Read-only table");
        }

        const pk = meta.pkField;
        const jsonData = JSON.parse(fs.readFileSync(abs, "utf8"));
        const arr = getAtPath(jsonData, tablePath);

        if (!Array.isArray(arr)) {
          throw new Error("Table path does not point to an array");
        }

        // Handle # column (row index) as primary key
        let rowIndex;
        if (pk === "#") {
          // Use id directly as array index
          rowIndex = parseInt(id);
          if (rowIndex < 0 || rowIndex >= arr.length) {
            throw new Error(
              `Row index ${id} out of bounds (array length: ${arr.length})`
            );
          }
        } else {
          // Use normal field-based lookup
          rowIndex = arr.findIndex((row) => row?.[pk] === id);
          if (rowIndex < 0) {
            throw new Error("Row not found");
          }
        }

        // Conflict detection
        const currentValue = arr[rowIndex][field];
        if (
          typeof oldValue !== "undefined" &&
          JSON.stringify(currentValue) !== JSON.stringify(oldValue)
        ) {
          return { conflict: true, current: currentValue };
        }

        // Update the field
        arr[rowIndex][field] = newValue;

        // Atomic write
        const tempPath = abs + ".tmp";
        fs.writeFileSync(tempPath, JSON.stringify(jsonData, null, 2));
        fs.renameSync(tempPath, abs);

        log("INFO", "JSON field updated by ID", {
          filePath,
          tablePath,
          id,
          field,
          newValue,
        });
        return { success: true, message: "Field updated successfully" };
      } catch (e) {
        log("ERROR", "Failed to update JSON field by ID", {
          filePath,
          tablePath,
          id,
          field,
          error: e.message,
        });
        return { error: e.message };
      }
    }
  );

  ipcMain.handle(
    "json:createRow",
    async (event, filePath, tablePath, newRow) => {
      try {
        console.log("🆕 Creating new row:", { filePath, tablePath, newRow });

        const abs = require("path").resolve(filePath);

        // Get schema to validate table is CRUD-enabled
        const schema = getJsonSchema(abs);
        console.log(
          "📋 Full schema for createRow:",
          JSON.stringify(schema, null, 2)
        );

        const meta = schema.byPath[tablePath];

        console.log("📋 Table metadata for path '" + tablePath + "':", meta);
        console.log("📋 Available schema paths:", Object.keys(schema.byPath));

        if (!meta?.allowCrud) {
          console.error("❌ Table not CRUD enabled:", {
            meta,
            availablePaths: Object.keys(schema.byPath),
          });
          throw new Error("Read-only table");
        }

        const jsonData = JSON.parse(fs.readFileSync(abs, "utf8"));
        const arr = getAtPath(jsonData, tablePath);

        if (!Array.isArray(arr)) {
          throw new Error("Table path does not point to an array");
        }

        const pk = meta.pkField;
        let finalRow = { ...newRow };

        // Handle # column (row index) as primary key - no need to set it, it's the index
        if (pk === "#") {
          // For # column, we don't need to store the PK in the row data
          // The PK is the row index itself
          console.log(`🔑 Using row index (#) as PK - will be ${arr.length}`);
        } else {
          // Auto-generate primary key if not provided for other PK types
          if (finalRow?.[pk] == null) {
            console.log(`🔑 Auto-generating PK for field: ${pk}`);

            if (pk === "id" || pk === "rowId") {
              // Find next available numeric ID
              const existingIds = arr
                .map((item) => item[pk])
                .filter((id) => typeof id === "number");
              const maxId =
                existingIds.length > 0 ? Math.max(...existingIds) : 0;
              finalRow[pk] = maxId + 1;
              console.log(`🔑 Generated numeric ID: ${finalRow[pk]}`);
            } else if (pk === "uuid") {
              // Generate simple UUID-like string
              finalRow[pk] =
                "uuid-" +
                Date.now() +
                "-" +
                Math.random().toString(36).substr(2, 9);
              console.log(`🔑 Generated UUID: ${finalRow[pk]}`);
            } else {
              // For other fields, use a timestamp-based value
              finalRow[pk] = `item-${Date.now()}`;
              console.log(`🔑 Generated string ID: ${finalRow[pk]}`);
            }
          }

          // Check for duplicate PK (only for non-# columns)
          if (arr.some((r) => r?.[pk] === finalRow[pk])) {
            throw new Error(`Duplicate PK ${finalRow[pk]}`);
          }
        }

        // Enhanced: Add default values for missing fields based on existing data structure
        // including nested structure templates with headers
        if (arr.length > 0) {
          const sampleItem = arr[0];
          Object.keys(sampleItem).forEach((key) => {
            if (!(key in finalRow)) {
              const sampleValue = sampleItem[key];
              if (typeof sampleValue === "string") {
                finalRow[key] = `New ${key}`;
              } else if (typeof sampleValue === "number") {
                finalRow[key] = 0;
              } else if (typeof sampleValue === "boolean") {
                finalRow[key] = false;
              } else if (Array.isArray(sampleValue)) {
                // Enhanced: Create array with template structure if it contains objects
                if (
                  sampleValue.length > 0 &&
                  typeof sampleValue[0] === "object" &&
                  !Array.isArray(sampleValue[0])
                ) {
                  // Array of objects - create template with headers from existing data
                  const templateObj = {};
                  const allKeys = new Set();

                  // Collect all possible keys from existing objects in this array
                  sampleValue.slice(0, 5).forEach((obj) => {
                    if (obj && typeof obj === "object") {
                      Object.keys(obj).forEach((k) => allKeys.add(k));
                    }
                  });

                  // Create template object with placeholder values
                  allKeys.forEach((k) => {
                    const sampleVal = sampleValue.find(
                      (obj) => obj && obj[k] !== undefined
                    )?.[k];
                    if (typeof sampleVal === "string") templateObj[k] = "";
                    else if (typeof sampleVal === "number") templateObj[k] = 0;
                    else if (typeof sampleVal === "boolean")
                      templateObj[k] = false;
                    else if (Array.isArray(sampleVal)) {
                      // Enhanced: Create deeper nested array templates
                      if (
                        sampleVal.length > 0 &&
                        typeof sampleVal[0] === "object"
                      ) {
                        const nestedObj = {};
                        const nestedKeys = new Set();

                        // Collect keys from all items in nested array
                        sampleVal.slice(0, 3).forEach((item) => {
                          if (item && typeof item === "object") {
                            Object.keys(item).forEach((nk) =>
                              nestedKeys.add(nk)
                            );
                          }
                        });

                        // Create nested template with proper values
                        nestedKeys.forEach((nk) => {
                          const nestedVal = sampleVal.find(
                            (item) => item && item[nk] !== undefined
                          )?.[nk];
                          if (typeof nestedVal === "string") nestedObj[nk] = "";
                          else if (typeof nestedVal === "number")
                            nestedObj[nk] = 0;
                          else if (typeof nestedVal === "boolean")
                            nestedObj[nk] = false;
                          else if (Array.isArray(nestedVal))
                            nestedObj[nk] = []; // Deeper nesting
                          else if (
                            typeof nestedVal === "object" &&
                            nestedVal !== null
                          )
                            nestedObj[nk] = {}; // Deeper objects
                          else nestedObj[nk] = null;
                        });

                        templateObj[k] = [nestedObj];
                        console.log(
                          `  📋 Created nested array template for ${key}.${k}:`,
                          Object.keys(nestedObj)
                        );
                      } else {
                        templateObj[k] = [];
                      }
                    } else if (
                      typeof sampleVal === "object" &&
                      sampleVal !== null
                    ) {
                      // Enhanced: Create deeper nested object templates
                      const nestedObj = {};
                      Object.keys(sampleVal).forEach((nk) => {
                        const nestedVal = sampleVal[nk];
                        if (typeof nestedVal === "string") nestedObj[nk] = "";
                        else if (typeof nestedVal === "number")
                          nestedObj[nk] = 0;
                        else if (typeof nestedVal === "boolean")
                          nestedObj[nk] = false;
                        else if (Array.isArray(nestedVal)) {
                          // Handle nested arrays in nested objects
                          if (
                            nestedVal.length > 0 &&
                            typeof nestedVal[0] === "object"
                          ) {
                            const deepNestedObj = {};
                            Object.keys(nestedVal[0]).forEach((dnk) => {
                              const deepVal = nestedVal[0][dnk];
                              if (typeof deepVal === "string")
                                deepNestedObj[dnk] = "";
                              else if (typeof deepVal === "number")
                                deepNestedObj[dnk] = 0;
                              else if (typeof deepVal === "boolean")
                                deepNestedObj[dnk] = false;
                              else deepNestedObj[dnk] = null;
                            });
                            nestedObj[nk] = [deepNestedObj];
                            console.log(
                              `    📋 Created deep nested array template for ${key}.${k}.${nk}:`,
                              Object.keys(deepNestedObj)
                            );
                          } else {
                            nestedObj[nk] = [];
                          }
                        } else if (
                          typeof nestedVal === "object" &&
                          nestedVal !== null
                        )
                          nestedObj[nk] = {};
                        else nestedObj[nk] = null;
                      });
                      templateObj[k] = nestedObj;
                      console.log(
                        `  📋 Created nested object template for ${key}.${k}:`,
                        Object.keys(nestedObj)
                      );
                    } else templateObj[k] = null;
                  });

                  finalRow[key] = [templateObj]; // Start with one template item
                  console.log(
                    `🏗️ Created array template for ${key} with headers:`,
                    Object.keys(templateObj)
                  );
                } else {
                  finalRow[key] = []; // Empty array for non-object arrays
                }
              } else if (
                typeof sampleValue === "object" &&
                sampleValue !== null
              ) {
                // Enhanced: Create object template with headers from existing data
                const templateObj = {};
                const sampleKeys = Object.keys(sampleValue);

                // Analyze multiple sample objects to get all possible keys
                const allSampleObjects = arr
                  .slice(0, 5)
                  .map((item) => item[key])
                  .filter(
                    (val) =>
                      val && typeof val === "object" && !Array.isArray(val)
                  );
                const allKeys = new Set();

                allSampleObjects.forEach((obj) => {
                  Object.keys(obj).forEach((k) => allKeys.add(k));
                });

                // If no other samples, use the first one
                if (allKeys.size === 0) {
                  sampleKeys.forEach((k) => allKeys.add(k));
                }

                // Create template object with appropriate default values
                allKeys.forEach((k) => {
                  const sampleVal =
                    allSampleObjects.find((obj) => obj[k] !== undefined)?.[k] ||
                    sampleValue[k];
                  if (typeof sampleVal === "string") templateObj[k] = "";
                  else if (typeof sampleVal === "number") templateObj[k] = 0;
                  else if (typeof sampleVal === "boolean")
                    templateObj[k] = false;
                  else if (Array.isArray(sampleVal)) {
                    // Enhanced: Nested array - create deeper templates if it contains objects
                    if (
                      sampleVal.length > 0 &&
                      typeof sampleVal[0] === "object"
                    ) {
                      const nestedTemplate = {};
                      const nestedKeys = new Set();

                      // Collect all keys from nested array items
                      sampleVal.slice(0, 3).forEach((item) => {
                        if (item && typeof item === "object") {
                          Object.keys(item).forEach((nk) => nestedKeys.add(nk));
                        }
                      });

                      // Create comprehensive nested template
                      nestedKeys.forEach((nk) => {
                        const nv = sampleVal.find(
                          (item) => item && item[nk] !== undefined
                        )?.[nk];
                        if (typeof nv === "string") nestedTemplate[nk] = "";
                        else if (typeof nv === "number") nestedTemplate[nk] = 0;
                        else if (typeof nv === "boolean")
                          nestedTemplate[nk] = false;
                        else if (Array.isArray(nv)) {
                          // Handle arrays within nested arrays
                          if (nv.length > 0 && typeof nv[0] === "object") {
                            const deepTemplate = {};
                            Object.keys(nv[0]).forEach((dk) => {
                              const dv = nv[0][dk];
                              if (typeof dv === "string") deepTemplate[dk] = "";
                              else if (typeof dv === "number")
                                deepTemplate[dk] = 0;
                              else if (typeof dv === "boolean")
                                deepTemplate[dk] = false;
                              else deepTemplate[dk] = null;
                            });
                            nestedTemplate[nk] = [deepTemplate];
                            console.log(
                              `    📋 Created deep array template for ${key}.${nk}:`,
                              Object.keys(deepTemplate)
                            );
                          } else {
                            nestedTemplate[nk] = [];
                          }
                        } else if (typeof nv === "object" && nv !== null) {
                          // Handle objects within nested arrays
                          const deepObjTemplate = {};
                          Object.keys(nv).forEach((onk) => {
                            const ov = nv[onk];
                            if (typeof ov === "string")
                              deepObjTemplate[onk] = "";
                            else if (typeof ov === "number")
                              deepObjTemplate[onk] = 0;
                            else if (typeof ov === "boolean")
                              deepObjTemplate[onk] = false;
                            else if (Array.isArray(ov))
                              deepObjTemplate[onk] = [];
                            else if (typeof ov === "object" && ov !== null)
                              deepObjTemplate[onk] = {};
                            else deepObjTemplate[onk] = null;
                          });
                          nestedTemplate[nk] = deepObjTemplate;
                          console.log(
                            `    📋 Created deep object template for ${key}.${nk}:`,
                            Object.keys(deepObjTemplate)
                          );
                        } else nestedTemplate[nk] = null;
                      });
                      templateObj[k] = [nestedTemplate];
                      console.log(
                        `  📋 Created nested array template for ${key}.${k}:`,
                        Object.keys(nestedTemplate)
                      );
                    } else {
                      templateObj[k] = [];
                    }
                  } else if (
                    typeof sampleVal === "object" &&
                    sampleVal !== null
                  ) {
                    // Enhanced: Nested object - create deeper templates
                    const nestedObjTemplate = {};
                    Object.keys(sampleVal).forEach((nk) => {
                      const nv = sampleVal[nk];
                      if (typeof nv === "string") nestedObjTemplate[nk] = "";
                      else if (typeof nv === "number")
                        nestedObjTemplate[nk] = 0;
                      else if (typeof nv === "boolean")
                        nestedObjTemplate[nk] = false;
                      else if (Array.isArray(nv)) {
                        if (nv.length > 0 && typeof nv[0] === "object") {
                          const deepArrTemplate = {};
                          Object.keys(nv[0]).forEach((dk) => {
                            const dv = nv[0][dk];
                            if (typeof dv === "string")
                              deepArrTemplate[dk] = "";
                            else if (typeof dv === "number")
                              deepArrTemplate[dk] = 0;
                            else if (typeof dv === "boolean")
                              deepArrTemplate[dk] = false;
                            else deepArrTemplate[dk] = null;
                          });
                          nestedObjTemplate[nk] = [deepArrTemplate];
                          console.log(
                            `    📋 Created deep nested array for ${key}.${nk}:`,
                            Object.keys(deepArrTemplate)
                          );
                        } else {
                          nestedObjTemplate[nk] = [];
                        }
                      } else if (typeof nv === "object" && nv !== null) {
                        // Deep nested objects
                        const deepNestedObj = {};
                        Object.keys(nv).forEach((dnk) => {
                          const dnv = nv[dnk];
                          if (typeof dnv === "string") deepNestedObj[dnk] = "";
                          else if (typeof dnv === "number")
                            deepNestedObj[dnk] = 0;
                          else if (typeof dnv === "boolean")
                            deepNestedObj[dnk] = false;
                          else if (Array.isArray(dnv)) deepNestedObj[dnk] = [];
                          else if (typeof dnv === "object" && dnv !== null)
                            deepNestedObj[dnk] = {};
                          else deepNestedObj[dnk] = null;
                        });
                        nestedObjTemplate[nk] = deepNestedObj;
                        console.log(
                          `    📋 Created deep nested object for ${key}.${nk}:`,
                          Object.keys(deepNestedObj)
                        );
                      } else nestedObjTemplate[nk] = null;
                    });
                    templateObj[k] = nestedObjTemplate;
                    console.log(
                      `  📋 Created nested object template for ${key}.${k}:`,
                      Object.keys(nestedObjTemplate)
                    );
                  } else {
                    templateObj[k] = null;
                  }
                });

                finalRow[key] = templateObj;
                console.log(
                  `🏗️ Created object template for ${key} with headers:`,
                  Object.keys(templateObj)
                );
              } else {
                finalRow[key] = null;
              }
            }
          });
        } else {
          // If no existing data, create minimal row
          if (pk !== "#") {
            // Only add PK field if it's not # column
            finalRow[pk] = finalRow[pk] || "new-item";
          }
        }

        console.log("✨ Final row to add:", finalRow);
        console.log("📊 Current array length:", arr.length);
        console.log(
          "🎯 Effective PK will be:",
          pk === "#" ? arr.length : finalRow[pk]
        );

        // Add new row at the end
        const newIndex = arr.length;
        arr.push(finalRow);

        console.log("📈 New array length:", arr.length);

        // Atomic write
        const tempPath = abs + ".tmp";
        fs.writeFileSync(tempPath, JSON.stringify(jsonData, null, 2));
        fs.renameSync(tempPath, abs);

        // Determine the effective PK value for response
        const effectivePkValue = pk === "#" ? newIndex : finalRow[pk];

        log("INFO", "JSON row created", {
          filePath,
          tablePath,
          rowId: effectivePkValue,
        });
        console.log("✅ Row created successfully");
        return {
          success: true,
          message: "Row created successfully",
          newRow: finalRow,
          pkValue: effectivePkValue,
        };
      } catch (e) {
        console.error("❌ Failed to create row:", e);
        log("ERROR", "Failed to create JSON row", {
          filePath,
          tablePath,
          error: e.message,
        });
        return { error: e.message };
      }
    }
  );

  ipcMain.handle(
    "json:deleteRow",
    async (event, filePath, tablePath, recordId) => {
      try {
        console.log("🗑️ Deleting row:", { filePath, tablePath, recordId });

        const abs = require("path").resolve(filePath);

        // Get schema to validate table is CRUD-enabled
        const schema = getJsonSchema(abs);
        console.log(
          "📋 Full schema for deleteRow:",
          JSON.stringify(schema, null, 2)
        );

        const meta = schema.byPath[tablePath];

        console.log(
          "📋 Delete - table metadata for path '" + tablePath + "':",
          meta
        );
        console.log("📋 Available schema paths:", Object.keys(schema.byPath));

        if (!meta?.allowCrud) {
          console.error("❌ Delete: Table not CRUD enabled:", {
            meta,
            availablePaths: Object.keys(schema.byPath),
          });
          throw new Error("Read-only table");
        }

        const pk = meta.pkField;
        console.log(`🔑 Looking for row with ${pk} = ${recordId}`);

        const jsonData = JSON.parse(fs.readFileSync(abs, "utf8"));
        const arr = getAtPath(jsonData, tablePath);

        if (!Array.isArray(arr)) {
          throw new Error("Table path does not point to an array");
        }

        console.log(
          "🔍 Current array contents:",
          arr.map((item, idx) => ({
            index: idx,
            pkValue: pk === "#" ? idx : item[pk],
            item: item,
          }))
        );

        // Handle # column (row index) as primary key
        let index;
        if (pk === "#") {
          // Use recordId directly as array index
          index = parseInt(recordId);
          if (index < 0 || index >= arr.length) {
            throw new Error(
              `Row index ${recordId} out of bounds (array length: ${arr.length})`
            );
          }
        } else {
          // Use normal field-based lookup
          index = arr.findIndex((row) => row?.[pk] === recordId);
        }

        if (index === -1) {
          console.error(`❌ Row not found with ${pk} = ${recordId}`);
          throw new Error(`Row not found with ${pk} = ${recordId}`);
        }

        console.log(`✂️ Removing row at index ${index}:`, arr[index]);

        // Remove the row
        arr.splice(index, 1);

        // Atomic write
        const tempPath = abs + ".tmp";
        fs.writeFileSync(tempPath, JSON.stringify(jsonData, null, 2));
        fs.renameSync(tempPath, abs);

        log("INFO", "JSON row deleted", { filePath, tablePath, recordId });
        console.log("✅ Row deleted successfully");
        return { success: true, message: "Row deleted successfully" };
      } catch (e) {
        console.error("❌ Failed to delete row:", e);
        log("ERROR", "Failed to delete JSON row", {
          filePath,
          tablePath,
          recordId,
          error: e.message,
        });
        return { error: e.message };
      }
    }
  );

  ipcMain.handle("json:getSchema", async (event, filePath) => {
    try {
      const abs = require("path").resolve(filePath);
      const schema = getJsonSchema(abs);
      return schema;
    } catch (e) {
      log("ERROR", "Failed to get JSON schema", { filePath, error: e.message });
      return { byPath: {} };
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

// Helper functions for JSON CRUD operations
function getAtPath(obj, path) {
  if (!path) return obj;

  const parts = parsePath(path);
  let current = obj;

  for (const part of parts) {
    if (current == null) return undefined;

    if (typeof part === "number") {
      current = current[part];
    } else {
      current = current[part];
    }
  }

  return current;
}

function setAtPath(obj, path, value) {
  if (!path) return;

  const parts = parsePath(path);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];

    if (current[part] == null) {
      current[part] = typeof nextPart === "number" ? [] : {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

function parsePath(path) {
  const parts = [];
  let current = "";
  let inBracket = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === "[") {
      if (current) {
        parts.push(current);
        current = "";
      }
      inBracket = true;
    } else if (char === "]") {
      if (current) {
        parts.push(parseInt(current));
        current = "";
      }
      inBracket = false;
    } else if (char === "." && !inBracket) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(inBracket ? parseInt(current) : current);
  }

  return parts;
}

function getJsonSchema(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const schema = { byPath: {} };

    function analyzeNode(node, currentPath) {
      if (Array.isArray(node) && node.length > 0) {
        const objectItems = node.filter(
          (item) => item && typeof item === "object" && !Array.isArray(item)
        );

        if (objectItems.length === node.length && node.length > 0) {
          // Array of objects - analyze for CRUD capability
          const columns = new Set();
          let isLeaf = true;

          // Get union of all keys
          objectItems.forEach((obj) => {
            Object.keys(obj).forEach((key) => columns.add(key));
          });

          // Check if all values are scalar (leaf condition)
          for (const obj of objectItems.slice(0, 10)) {
            // Sample first 10
            for (const key of columns) {
              const val = obj[key];
              if (val != null && typeof val === "object") {
                isLeaf = false;
                break;
              }
            }
            if (!isLeaf) break;
          }

          // Detect primary key - improved detection with more candidates
          const pkCandidates = [
            "#",
            "id",
            "uuid",
            "ID",
            "key",
            "name",
            "_id",
            "rowId",
            "pk",
            "primary_key",
          ];
          let pkField = null;

          for (const candidate of pkCandidates) {
            if (columns.has(candidate)) {
              // Check if values are unique and non-null
              const values = new Set();
              let isUnique = true;

              for (const obj of objectItems) {
                const val = obj[candidate];
                if (val == null || values.has(val)) {
                  isUnique = false;
                  break;
                }
                values.add(val);
              }

              if (isUnique) {
                pkField = candidate;
                break;
              }
            }
          }

          // If no explicit PK found, try to find any field with unique values
          if (!pkField) {
            for (const col of Array.from(columns)) {
              const values = new Set();
              let isUnique = true;
              let hasValidValues = true;

              for (const obj of objectItems) {
                const val = obj[col];
                if (val == null || val === "" || val === 0) {
                  hasValidValues = false;
                  break;
                }
                if (values.has(val)) {
                  isUnique = false;
                  break;
                }
                values.add(val);
              }

              if (isUnique && hasValidValues) {
                pkField = col;
                console.log(
                  `Auto-detected PK field: ${col} for path: ${currentPath}`
                );
                break;
              }
            }
          }

          // If still no PK found, use row index as PK (# column)
          if (!pkField) {
            pkField = "#";
            console.log(`Using row index (#) as PK for path: ${currentPath}`);
          }

          schema.byPath[currentPath] = {
            type: "arrayOfObjects",
            columns: Array.from(columns),
            isLeaf,
            pkField,
            allowCrud: pkField != null, // Allow CRUD for any array with a primary key
            itemCount: node.length,
          };

          // Continue analyzing nested objects within each array item
          node.forEach((item, index) => {
            if (item && typeof item === "object" && !Array.isArray(item)) {
              Object.keys(item).forEach((key) => {
                const nestedPath = `${currentPath}[${index}].${key}`;
                analyzeNode(item[key], nestedPath);
              });
            }
          });
        }
      }

      if (node && typeof node === "object" && !Array.isArray(node)) {
        Object.keys(node).forEach((key) => {
          const childPath = currentPath ? `${currentPath}.${key}` : key;
          analyzeNode(node[key], childPath);
        });
      }
    }

    analyzeNode(data, "");
    return schema;
  } catch (e) {
    log("ERROR", "Failed to analyze JSON schema", {
      filePath,
      error: e.message,
    });
    return { byPath: {} };
  }
}

// Export for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getAtPath,
    setAtPath,
    parsePath,
    getJsonSchema,
  };
}
