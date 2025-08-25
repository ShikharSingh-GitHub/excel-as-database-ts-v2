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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const indexHtml = path.join(__dirname, "renderer", "index.html");
  mainWindow.loadFile(indexHtml);
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

ipcMain.handle("folder:pick", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (res.canceled) return null;
  return res.filePaths[0];
});

ipcMain.handle("folder:scan", async (event, folderPath) => {
  return excelService.scanFolder(folderPath);
});

ipcMain.handle("workbook:meta", async (event, filePath) => {
  return excelService.getWorkbookMeta(filePath);
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
