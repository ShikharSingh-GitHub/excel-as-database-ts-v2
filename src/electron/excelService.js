const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const lockfile = require("proper-lockfile");
const { v4: uuidv4 } = require("uuid");

const CONFIG_PATH = path.join(__dirname, "..", "..", "config.json");
const LOG_DIR = path.join(__dirname, "..", "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "excel-db.log");

// Ensure log directory exists
function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (e) {
    // ignore
  }
}

// Logging function
function log(level, message, ctx) {
  try {
    ensureLogDir();
    const ts = new Date().toISOString();
    const line =
      `${ts} [${level}] ${message}` +
      (ctx ? " " + JSON.stringify(ctx) : "") +
      "\n";
    fs.appendFileSync(LOG_FILE, line);
  } catch (e) {
    // ignore logging errors
  }
}

// Configuration functions
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    // Return default config if file doesn't exist
    return {
      folderPath: null,
      pkName: "id",
      cacheTtlMs: 2000,
      pageSizeDefault: 25,
      maxPageSize: 200,
      readOnlySheets: [],
      ignoreSheets: ["_metadata", "config", "temp"],
      autoRefreshSeconds: 0,
      recentWorkbooks: [],
      ui: {
        theme: "auto",
        defaultSort: "asc",
        showSystemColumns: false,
      },
      validation: {
        enableTypeHints: true,
        strictMode: false,
      },
      headerRowConfig: {}, // Added for configurable header rows
    };
  }
}

function writeConfig(partial) {
  const cfg = Object.assign({}, readConfig(), partial);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
  return cfg;
}

// Add recent workbook to config
function addRecentWorkbook(filePath) {
  const cfg = readConfig();
  const recent = cfg.recentWorkbooks || [];
  const index = recent.indexOf(filePath);
  if (index > -1) {
    recent.splice(index, 1);
  }
  recent.unshift(filePath);
  // Keep only last 10
  cfg.recentWorkbooks = recent.slice(0, 10);
  writeConfig(cfg);
  return cfg.recentWorkbooks;
}

// Get recent workbooks
function getRecentWorkbooks() {
  const cfg = readConfig();
  return cfg.recentWorkbooks || [];
}

// Check if sheet is read-only
function isSheetReadOnly(sheetName) {
  const cfg = readConfig();
  return (cfg.readOnlySheets || []).includes(sheetName);
}

// Get configuration values
function getConfigValue(key, defaultValue = null) {
  const cfg = readConfig();
  return cfg[key] !== undefined ? cfg[key] : defaultValue;
}

// Sort state management
function getSortState(filePath) {
  const cfg = readConfig() || {};
  return (cfg.sortState && cfg.sortState[filePath]) || null;
}

function setSortState(filePath, state) {
  const cfg = readConfig() || {};
  cfg.sortState = cfg.sortState || {};
  cfg.sortState[filePath] = state;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
  return cfg.sortState[filePath];
}

// Excel file detection
function isVisibleExcel(filename) {
  const lower = String(filename || "").toLowerCase();
  return (
    (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) &&
    !String(filename).startsWith(".")
  );
}

// Folder scanning
function scanFolder(folderPath) {
  const cfg = readConfig();
  const dir = folderPath || (cfg && cfg.folderPath) || null;
  if (!dir) return { error: "no-folder" };
  if (!fs.existsSync(dir)) return { error: "not-found" };

  const files = fs
    .readdirSync(dir)
    .filter((f) => isVisibleExcel(f))
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return {
        name: f,
        path: path.join(dir, f),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { folder: dir, files };
}

// Get header row position for a specific sheet
function getHeaderRowPosition(filePath, sheetName) {
  const cfg = readConfig();
  const fileName = path.basename(filePath);
  const headerConfig = cfg.headerRowConfig || {};

  // Check if there's a specific config for this file and sheet
  if (
    headerConfig[fileName] &&
    headerConfig[fileName][sheetName] !== undefined
  ) {
    return headerConfig[fileName][sheetName];
  }

  // Default to row 1 (0-based index)
  return 0;
}

// Workbook metadata
function getWorkbookMeta(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { error: "not-found" };

  try {
    const cfg = readConfig() || {};
    const ignoreSheets = cfg.ignoreSheets || [];
    const wb = XLSX.readFile(filePath);

    if (!wb || !wb.SheetNames || !Array.isArray(wb.SheetNames)) {
      return { error: "parse-error" };
    }

    const sheets = wb.SheetNames.filter((n) => !ignoreSheets.includes(n)).map(
      (name) => {
        try {
          const ws = wb.Sheets[name];
          if (!ws || !ws["!ref"]) {
            return { name, columns: [], rows: 0, unavailable: true };
          }

          const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
          const headerRow = getHeaderRowPosition(filePath, name);

          // Check if the header row is within the sheet range
          if (headerRow > range.e.r) {
            return {
              name,
              columns: [],
              rows: 0,
              unavailable: true,
              error: "Header row beyond sheet range",
            };
          }

          const headers = [];
          const seen = new Set();

          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
            const val = cell ? String(cell.v).trim() : "";
            if (val) {
              let orig = val;
              let i = 1;
              while (seen.has(val)) {
                val = `${orig} (${i})`;
                i++;
              }
              seen.add(val);
              headers.push(val);
            }
          }

          // Calculate rows excluding header rows
          const dataRows = Math.max(0, range.e.r - headerRow);
          const unavailable = headers.length === 0;

          if (unavailable) {
            log(
              "WARN",
              `Sheet '${name}' has no headers at row ${headerRow + 1}`,
              {
                filePath,
                sheetName: name,
                headerRow: headerRow + 1,
              }
            );
          }

          return {
            name,
            columns: headers,
            rows: dataRows,
            unavailable,
            headerRow: headerRow + 1, // Convert to 1-based for display
            totalRows: range.e.r + 1,
          };
        } catch (sheetError) {
          log("ERROR", `Error processing sheet '${name}'`, {
            filePath,
            sheetName: name,
            error: sheetError.message,
          });
          return {
            name,
            columns: [],
            rows: 0,
            unavailable: true,
            error: sheetError.message,
          };
        }
      }
    );

    log("INFO", "Workbook metadata retrieved", {
      filePath,
      sheetCount: sheets.length,
    });

    return { path: filePath, sheets, mtimeMs: fs.statSync(filePath).mtimeMs };
  } catch (e) {
    log("ERROR", "getWorkbookMeta parse error", {
      filePath,
      message: e.message,
      stack: e.stack,
    });
    return { error: "parse-error", message: e.message };
  }
}

// Cache management
const cache = new Map();

function cacheGet(key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    log("INFO", "Cache expired", { key });
    cache.delete(key);
    return null;
  }

  log("INFO", "Cache hit", { key });
  return entry.value;
}

function cacheSet(key, value, mtimeMs) {
  cache.set(key, { value, timestamp: Date.now(), mtimeMs });
  log("INFO", "Cache set", { key });
}

function invalidateCache(filePath) {
  const keysToInvalidate = Array.from(cache.keys()).filter((key) =>
    key.startsWith(filePath)
  );
  keysToInvalidate.forEach((key) => {
    cache.delete(key);
    log("INFO", "Cache invalidated", { key });
  });
}

// Sheet reading with pagination, filtering, and sorting
function readSheet(filePath, sheetName, opts = {}) {
  const page = Math.max(1, (opts && opts.page) || 1);
  const pageSize = Math.max(1, Math.min((opts && opts.pageSize) || 25, 200));
  const filter = ((opts && opts.filter) || "").toLowerCase();
  const columnFilters = (opts && opts.columnFilters) || {};
  const sort = (opts && opts.sort) || null;

  if (!filePath || !fs.existsSync(filePath)) return { error: "not-found" };

  try {
    const cfg = readConfig() || {};
    const ttl = cfg.cacheTtlMs || 2000;
    const cacheKey = [
      filePath,
      sheetName,
      String(page),
      String(pageSize),
      String(filter),
      JSON.stringify(columnFilters || {}),
      JSON.stringify(sort || {}),
    ].join("::");

    const cached = cacheGet(cacheKey, ttl);
    if (cached) return cached;

    const wb = XLSX.readFile(filePath);
    if (!wb || !wb.SheetNames || !wb.SheetNames.includes(sheetName)) {
      log("ERROR", "Sheet not found or invalid workbook", {
        filePath,
        sheetName,
        hasWorkbook: !!wb,
        hasSheetNames: !!wb?.SheetNames,
        availableSheets: wb?.SheetNames || [],
      });
      return { error: "sheet-not-found" };
    }

    const ws = wb.Sheets[sheetName];
    if (!ws) {
      log("ERROR", "Worksheet is undefined", { filePath, sheetName });
      return { error: "sheet-not-found" };
    }

    // If the sheet has no range (!ref) it's effectively empty/ unavailable
    if (!ws["!ref"]) {
      log("WARN", "Worksheet has no range (!ref)", { filePath, sheetName });
      return {
        error: "sheet-unavailable",
        message: "No headers (row 1 empty) - sheet unavailable for table view",
      };
    }

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    const headerRow = getHeaderRowPosition(filePath, sheetName);

    // Check if header row is within sheet range
    if (headerRow > range.e.r) {
      log("ERROR", "Header row beyond sheet range", {
        filePath,
        sheetName,
        headerRow,
        maxRow: range.e.r,
      });
      return {
        error: "sheet-unavailable",
        message: `Header row ${headerRow + 1} is beyond the sheet range`,
      };
    }

    const headers = [];
    const seenHeaders = new Set();

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
      let val = cell ? String(cell.v).trim() : "";
      if (val) {
        // Handle duplicate column names by appending a number
        let originalVal = val;
        let counter = 1;
        while (seenHeaders.has(val)) {
          val = `${originalVal} (${counter})`;
          counter++;
        }
        seenHeaders.add(val);
        headers.push(val);
      }
    }

    if (headers.length === 0) {
      log(
        "WARN",
        `Sheet '${sheetName}' has no headers at row ${headerRow + 1}`,
        {
          filePath,
          sheetName,
          headerRow: headerRow + 1,
        }
      );
      return {
        error: "sheet-unavailable",
        message: `No headers found at row ${
          headerRow + 1
        } - sheet unavailable for table view`,
      };
    }

    // Read data starting from the row after headers
    const dataStartRow = headerRow + 1;
    const json = XLSX.utils.sheet_to_json(ws, {
      defval: null,
      range: dataStartRow, // Start reading from the row after headers
      header: headers, // Use the headers we found
    });

    // apply global filter (contains across any column)
    let filtered = filter
      ? json.filter((row) =>
          Object.values(row).some(
            (v) => v != null && String(v).toLowerCase().includes(filter)
          )
        )
      : json;

    // apply per-column filters (contains semantics)
    const colFilterEntries = Object.entries(columnFilters || {}).filter(
      ([, v]) => v != null && String(v).trim() !== ""
    );
    if (colFilterEntries.length > 0) {
      filtered = filtered.filter((row) => {
        return colFilterEntries.every(([col, val]) => {
          const cell = row[col];
          if (cell == null) return false;
          return String(cell).toLowerCase().includes(String(val).toLowerCase());
        });
      });
    }

    const total = filtered.length;

    // apply server-side sort if requested
    if (sort && sort.key) {
      const key = sort.key;
      const dir = sort.dir === "desc" ? "desc" : "asc";
      filtered.sort((a, b) => {
        const A = a[key];
        const B = b[key];
        if (A == null && B == null) return 0;
        if (A == null) return -1;
        if (B == null) return 1;
        if (typeof A === "number" && typeof B === "number")
          return dir === "asc" ? A - B : B - A;
        const sA = String(A).toLowerCase();
        const sB = String(B).toLowerCase();
        if (sA < sB) return dir === "asc" ? -1 : 1;
        if (sA > sB) return dir === "asc" ? 1 : -1;
        return 0;
      });
    }

    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize);
    const result = { rows, total, page, pageSize, headers };

    log("DEBUG", "Sheet data", {
      sheetName,
      rows: result.rows.length,
      headers,
      headerRow: headerRow + 1,
      dataStartRow: dataStartRow + 1,
    });

    try {
      const mtime = fs.statSync(filePath).mtimeMs;
      cacheSet(cacheKey, result, mtime);
    } catch (e) {
      cacheSet(cacheKey, result, null);
    }

    return result;
  } catch (e) {
    log("ERROR", "readSheet error", {
      filePath,
      sheetName,
      message: e.message,
    });
    return { error: "read-error", message: e.message };
  }
}

// Helper function to read sheet as JSON
function readSheetJson(filePath, sheetName) {
  try {
    const wb = XLSX.readFile(filePath);
    if (!wb.SheetNames.includes(sheetName)) return null;
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: null });
    return { wb, ws, json };
  } catch (e) {
    log("ERROR", "readSheetJson error", {
      filePath,
      sheetName,
      message: e.message,
    });
    return null;
  }
}

// Ensure primary key and version fields exist
function ensurePkAndVersion(rows, pkName) {
  for (const r of rows) {
    if (!r.hasOwnProperty(pkName) || r[pkName] === null || r[pkName] === "") {
      r[pkName] = uuidv4();
    }
    if (!r.hasOwnProperty("_version") || r["_version"] == null) {
      r["_version"] = 1;
    }
  }
}

// Lock management
async function acquireLock(filePath, opts = {}) {
  const timeout = opts.timeoutMs || 5000;
  const start = Date.now();
  const retryDelay = 200;

  while (true) {
    try {
      const release = await lockfile.lock(filePath, { realpath: false });
      log("INFO", "Lock acquired", { filePath });
      return release;
    } catch (e) {
      if (Date.now() - start > timeout) {
        log("ERROR", "Lock acquisition timeout", { filePath });
        throw new Error("lock-timeout");
      }
      log("WARN", "Retrying lock acquisition", { filePath });
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }
}

// Atomic workbook writing
function writeWorkbookAtomic(filePath, workbook, bookType) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, `.${base}.tmp.${Date.now()}`);

  try {
    XLSX.writeFile(workbook, tmp, { bookType: bookType });
    fs.renameSync(tmp, filePath);
    log("INFO", "Workbook written atomically", { filePath });
  } catch (e) {
    log("ERROR", "Atomic write failed", { filePath, message: e.message });
    if (fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
        log("INFO", "Temporary file cleaned up after write failure", { tmp });
      } catch (cleanupError) {
        log("WARN", "Failed to clean up temporary file", {
          tmp,
          message: cleanupError.message,
        });
      }
    }
    throw e;
  }
}

// CRUD operations
async function createRow(filePath, sheetName, row, opts = {}) {
  try {
    const cfg = readConfig() || {};
    const readOnly = cfg.readOnlySheets || [];
    if (readOnly.includes(sheetName)) {
      log("WARN", "Attempt to create row in read-only sheet", {
        filePath,
        sheetName,
      });
      return { error: "read-only" };
    }

    const pkName = cfg.pkName || "id";
    const release = await acquireLock(filePath, { timeoutMs: 5000 });

    try {
      const r = readSheetJson(filePath, sheetName) || {
        wb: XLSX.readFile(filePath),
        json: [],
      };

      const wb = r.wb;
      const json = r.json;
      ensurePkAndVersion(json, pkName);

      const newRow = Object.assign({}, row);
      if (!newRow[pkName]) newRow[pkName] = uuidv4();
      newRow["_version"] = 1;
      newRow["_created_at"] = new Date().toISOString();
      newRow["_created_by"] = opts.user || "system";

      json.push(newRow);

      const headers = Array.from(new Set([].concat(...json.map(Object.keys))));
      const newWs = XLSX.utils.json_to_sheet(json, { header: headers });
      wb.Sheets[sheetName] = newWs;

      const ext = path.extname(filePath).toLowerCase().replace(".", "");
      const bookType = ext === "xlsm" ? "xlsm" : "xlsx";

      writeWorkbookAtomic(filePath, wb, bookType);
      invalidateCache(filePath);

      log("INFO", "Row created", { filePath, sheetName, row: newRow });
      return { success: true, row: newRow };
    } finally {
      try {
        await release();
      } catch (e) {
        log("WARN", "Failed to release lock after row creation", {
          filePath,
          sheetName,
        });
      }
    }
  } catch (e) {
    if (e.message === "lock-timeout") {
      log("ERROR", "Lock timeout during row creation", { filePath, sheetName });
      return { error: "lock-timeout" };
    }
    log("ERROR", "Row creation failed", {
      filePath,
      sheetName,
      message: e.message,
    });
    return { error: "write-error", message: e.message };
  }
}

async function updateRow(
  filePath,
  sheetName,
  pkValue,
  updates,
  expectedVersion,
  opts = {}
) {
  try {
    const cfg = readConfig() || {};
    const readOnly = cfg.readOnlySheets || [];
    if (readOnly.includes(sheetName)) {
      log("WARN", "Attempt to update row in read-only sheet", {
        filePath,
        sheetName,
      });
      return { error: "read-only" };
    }

    const pkName = cfg.pkName || "id";
    const release = await acquireLock(filePath, { timeoutMs: 5000 });

    try {
      const r = readSheetJson(filePath, sheetName) || {
        wb: XLSX.readFile(filePath),
        json: [],
      };

      const wb = r.wb;
      const json = r.json;

      const idx = json.findIndex((r) => String(r[pkName]) === String(pkValue));
      if (idx === -1) {
        log("WARN", "Row not found for update", {
          filePath,
          sheetName,
          pkValue,
        });
        return { error: "not-found" };
      }

      const current = json[idx];
      const curVer = current["_version"] || 0;

      if (
        expectedVersion != null &&
        Number(expectedVersion) !== Number(curVer)
      ) {
        log("WARN", "Version conflict during row update", {
          filePath,
          sheetName,
          pkValue,
          expectedVersion,
          currentVersion: curVer,
        });
        return { error: "version-conflict", current };
      }

      const updated = Object.assign({}, current, updates);
      updated["_version"] = (curVer || 0) + 1;
      updated["_updated_at"] = new Date().toISOString();
      updated["_updated_by"] = opts.user || "system";

      json[idx] = updated;

      const headers = Array.from(new Set([].concat(...json.map(Object.keys))));
      const newWs = XLSX.utils.json_to_sheet(json, { header: headers });
      wb.Sheets[sheetName] = newWs;

      const ext = path.extname(filePath).toLowerCase().replace(".", "");
      const bookType = ext === "xlsm" ? "xlsm" : "xlsx";

      writeWorkbookAtomic(filePath, wb, bookType);
      invalidateCache(filePath);

      log("INFO", "Row updated", { filePath, sheetName, pkValue, updates });
      return { success: true, row: updated };
    } finally {
      try {
        await release();
      } catch (e) {
        log("WARN", "Failed to release lock after row update", {
          filePath,
          sheetName,
        });
      }
    }
  } catch (e) {
    if (e.message === "lock-timeout") {
      log("ERROR", "Lock timeout during row update", { filePath, sheetName });
      return { error: "lock-timeout" };
    }
    log("ERROR", "Row update failed", {
      filePath,
      sheetName,
      message: e.message,
    });
    return { error: "write-error", message: e.message };
  }
}

async function deleteRow(filePath, sheetName, pkValue, expectedVersion) {
  try {
    const cfg = readConfig() || {};
    const readOnly = cfg.readOnlySheets || [];
    if (readOnly.includes(sheetName)) {
      log("WARN", "Attempt to delete row in read-only sheet", {
        filePath,
        sheetName,
      });
      return { error: "read-only" };
    }

    const pkName = cfg.pkName || "id";
    const release = await acquireLock(filePath, { timeoutMs: 5000 });

    try {
      const r = readSheetJson(filePath, sheetName) || {
        wb: XLSX.readFile(filePath),
        json: [],
      };

      const wb = r.wb;
      const json = r.json;

      const idx = json.findIndex((r) => String(r[pkName]) === String(pkValue));
      if (idx === -1) {
        log("WARN", "Row not found for deletion", {
          filePath,
          sheetName,
          pkValue,
        });
        return { error: "not-found" };
      }

      const current = json[idx];
      const curVer = current["_version"] || 0;

      if (
        expectedVersion != null &&
        Number(expectedVersion) !== Number(curVer)
      ) {
        log("WARN", "Version conflict during row deletion", {
          filePath,
          sheetName,
          pkValue,
          expectedVersion,
          currentVersion: curVer,
        });
        return { error: "version-conflict", current };
      }

      json.splice(idx, 1);

      const headers = Array.from(new Set([].concat(...json.map(Object.keys))));
      const newWs = XLSX.utils.json_to_sheet(json, { header: headers });
      wb.Sheets[sheetName] = newWs;

      const ext = path.extname(filePath).toLowerCase().replace(".", "");
      const bookType = ext === "xlsm" ? "xlsm" : "xlsx";

      writeWorkbookAtomic(filePath, wb, bookType);
      invalidateCache(filePath);

      log("INFO", "Row deleted", { filePath, sheetName, pkValue });
      return { success: true };
    } finally {
      try {
        await release();
      } catch (e) {
        log("WARN", "Failed to release lock after row deletion", {
          filePath,
          sheetName,
        });
      }
    }
  } catch (e) {
    if (e.message === "lock-timeout") {
      log("ERROR", "Lock timeout during row deletion", { filePath, sheetName });
      return { error: "lock-timeout" };
    }
    log("ERROR", "Row deletion failed", {
      filePath,
      sheetName,
      message: e.message,
    });
    return { error: "write-error", message: e.message };
  }
}

// Export workbook
function exportWorkbook(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      log("WARN", "Export failed: file not found", { filePath });
      return { error: "not-found", message: "File not found" };
    }

    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    const out = path.join(dir, `${base}.copy.${Date.now()}`);

    fs.copyFileSync(filePath, out);
    log("INFO", "Workbook exported", { src: filePath, dst: out });
    return { path: out };
  } catch (e) {
    log("ERROR", "Export workbook error", { filePath, message: e.message });
    return { error: "export-error", message: e.message };
  }
}

// Refresh folder
async function refreshFolder() {
  const cfg = readConfig();
  if (!cfg || !cfg.folderPath) return null;
  return scanFolder(cfg.folderPath);
}

module.exports = {
  readConfig,
  writeConfig,
  scanFolder,
  getWorkbookMeta,
  readSheet,
  readSheetJson,
  createRow,
  updateRow,
  deleteRow,
  exportWorkbook,
  refreshFolder,
  cacheGet,
  cacheSet,
  invalidateCache,
  getSortState,
  setSortState,
  addRecentWorkbook,
  getRecentWorkbooks,
  isSheetReadOnly,
  getConfigValue,
};
