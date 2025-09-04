const { contextBridge, ipcRenderer } = require("electron");

// Forward renderer console messages to the main process for easier debugging
const forwardConsole = (level, ...args) => {
  try {
    ipcRenderer.send("renderer:console", { level, args });
  } catch (e) {
    // ignore
  }
};

contextBridge.exposeInMainWorld("api", {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  // helper to let renderer forward console calls
  _forwardConsole: forwardConsole,

  // Configuration helpers
  config: {
    get: () => ipcRenderer.invoke("config:get"),
    set: (partial) => ipcRenderer.invoke("config:set", partial),
    getValue: (key, defaultValue) =>
      ipcRenderer.invoke("config:getValue", key, defaultValue),
    addRecentWorkbook: (filePath) =>
      ipcRenderer.invoke("config:addRecentWorkbook", filePath),
    getRecentWorkbooks: () => ipcRenderer.invoke("config:getRecentWorkbooks"),
    isSheetReadOnly: (sheetName) =>
      ipcRenderer.invoke("config:isSheetReadOnly", sheetName),
  },

  // Folder and file operations
  folder: {
    pick: () => ipcRenderer.invoke("folder:pick"),
    scan: (folderPath) => ipcRenderer.invoke("folder:scan", folderPath),
    refresh: () => ipcRenderer.invoke("folder:refresh"),
  },

  // Workbook operations
  workbook: {
    meta: (filePath) => ipcRenderer.invoke("workbook:meta", filePath),
    export: (filePath) => ipcRenderer.invoke("workbook:export", filePath),
    ensureDataSheet: (filePath, sourceSheetName) =>
      ipcRenderer.invoke("workbook:ensureDataSheet", filePath, sourceSheetName),
    save: (filePath, opts) =>
      ipcRenderer.invoke("workbook:save", filePath, opts),
  },

  // Sheet operations
  sheet: {
    read: (filePath, sheetName, opts) =>
      ipcRenderer.invoke("sheet:read", filePath, sheetName, opts),
    create: (filePath, sheetName, row) =>
      ipcRenderer.invoke("sheet:create", filePath, sheetName, row),
    update: (filePath, sheetName, pkValue, updates, expectedVersion, opts) =>
      ipcRenderer.invoke(
        "sheet:update",
        filePath,
        sheetName,
        pkValue,
        updates,
        expectedVersion,
        opts || {}
      ),
    delete: (filePath, sheetName, pkValue, expectedVersion) =>
      ipcRenderer.invoke(
        "sheet:delete",
        filePath,
        sheetName,
        pkValue,
        expectedVersion
      ),
  },

  // Sort operations
  sort: {
    get: (filePath) => ipcRenderer.invoke("sort:get", filePath),
    set: (filePath, state) => ipcRenderer.invoke("sort:set", filePath, state),
  },

  // XLSM operations
  xlsm: {
    getNewFiles: () => ipcRenderer.invoke("xlsm:getNewFiles"),
    clearNotifications: () => ipcRenderer.invoke("xlsm:clearNotifications"),
  },

  // JSON operations
  json: {
    read: (filePath) => ipcRenderer.invoke("json:read", filePath),
    write: (filePath, data) => ipcRenderer.invoke("json:write", filePath, data),
    fetch: (url, method, payload) => ipcRenderer.invoke("json:fetch", url, method, payload),
    save: (fileName, data) => ipcRenderer.invoke("json:save", fileName, data),
  },

  // Utility
  ping: () => ipcRenderer.invoke("ping"),
});
