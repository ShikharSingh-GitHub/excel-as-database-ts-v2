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
      hiddenSheets: [],
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

  // Prefer an absolute-path config if present, fall back to basename
  let configuredCandidate = undefined;
  if (
    headerConfig[filePath] &&
    headerConfig[filePath][sheetName] !== undefined
  ) {
    configuredCandidate = headerConfig[filePath][sheetName];
  } else if (
    headerConfig[fileName] &&
    headerConfig[fileName][sheetName] !== undefined
  ) {
    configuredCandidate = headerConfig[fileName][sheetName];
  }

  // Check if there's a specific config for this file and sheet
  if (configuredCandidate !== undefined) {
    // We have a configured header row. Validate it: if it looks like a data row,
    // attempt automatic detection and persist a correction.
    try {
      let configured = configuredCandidate;
      const wb = XLSX.readFile(filePath, { bookVBA: true, cellStyles: true });
      const ws = wb.Sheets[sheetName];
      if (!ws || !ws["!ref"]) return configured;
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

      // If configured header is outside range, return it (higher-level code will handle)
      // Allow persisted values that were accidentally stored 1-based.
      // If configured is greater than the 0-based end row but (configured-1)
      // falls inside the sheet, assume it's a 1-based value and adjust.
      if (configured > range.e.r) {
        if (configured - 1 <= range.e.r) {
          // convert to 0-based and persist correction
          const corrected = configured - 1;
          try {
            const cfg = readConfig() || {};
            cfg.headerRowConfig = cfg.headerRowConfig || {};
            cfg.headerRowConfig[fileName] = cfg.headerRowConfig[fileName] || {};
            cfg.headerRowConfig[fileName][sheetName] = corrected;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
            try {
              invalidateCache(filePath);
            } catch (e) {}
            log("INFO", "Normalized 1-based headerRow in config to 0-based", {
              filePath,
              sheetName,
              from: configured,
              to: corrected,
            });
          } catch (e) {}
          configured = corrected;
        } else {
          return configured;
        }
      }

      const configuredVals = [];
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cell = ws[XLSX.utils.encode_cell({ c, r: configured })];
        configuredVals.push(cell ? cell.v : null);
      }

      // If the configured row appears completely empty but the previous row
      // has values, it's likely the stored config was off-by-one (1-based vs 0-based)
      const nonEmptyConfigured = configuredVals.filter(
        (v) => v != null && String(v).trim() !== ""
      ).length;
      if (nonEmptyConfigured === 0 && configured > range.s.r) {
        // inspect previous row
        const prevVals = [];
        for (let c = range.s.c; c <= range.e.c; ++c) {
          const cell = ws[XLSX.utils.encode_cell({ c, r: configured - 1 })];
          prevVals.push(cell ? cell.v : null);
        }
        const nonEmptyPrev = prevVals.filter(
          (v) => v != null && String(v).trim() !== ""
        ).length;
        if (nonEmptyPrev > 0) {
          // correct configured to previous row and persist
          try {
            const cfg = readConfig() || {};
            cfg.headerRowConfig = cfg.headerRowConfig || {};
            cfg.headerRowConfig[fileName] = cfg.headerRowConfig[fileName] || {};
            cfg.headerRowConfig[fileName][sheetName] = configured - 1;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
            try {
              invalidateCache(filePath);
            } catch (e) {}
            log("INFO", "Adjusted off-by-one headerRow in config (empty row)", {
              filePath,
              sheetName,
              from: configured,
              to: configured - 1,
            });
          } catch (e) {}
          configured = configured - 1;
        }
      }

      if (isLikelyDataRow(configuredVals)) {
        const detected = detectHeaderRow(ws, range);
        if (detected != null && detected !== configured) {
          try {
            const cfg = readConfig() || {};
            cfg.headerRowConfig = cfg.headerRowConfig || {};
            // persist under both basename and absolute path to be robust across copies
            cfg.headerRowConfig[fileName] = cfg.headerRowConfig[fileName] || {};
            cfg.headerRowConfig[filePath] = cfg.headerRowConfig[filePath] || {};
            cfg.headerRowConfig[fileName][sheetName] = detected;
            cfg.headerRowConfig[filePath][sheetName] = detected;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
            log("INFO", "Corrected persisted headerRow for configured entry", {
              filePath,
              sheetName,
              from: configured,
              to: detected,
            });
          } catch (e) {
            // ignore persistence errors
          }
          return detected;
        }
      }

      return configured;
    } catch (e) {
      // If anything goes wrong validating, fall back to returning configured candidate
      return configuredCandidate;
    }
  }

  // No explicit configuration found — attempt automatic detection
  try {
    const wb = XLSX.readFile(filePath, { bookVBA: true, cellStyles: true });
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) return 0;
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

    // Detect header row using heuristic
    const detected = detectHeaderRow(ws, range);
    if (detected != null) {
      // Persist detected header row into config so we reuse it later
      try {
        const cfg = readConfig() || {};
        cfg.headerRowConfig = cfg.headerRowConfig || {};
        cfg.headerRowConfig[fileName] = cfg.headerRowConfig[fileName] || {};
        // only persist if not already set or different
        if (
          (cfg.headerRowConfig[fileName] || {})[sheetName] !== detected ||
          (cfg.headerRowConfig[filePath] || {})[sheetName] !== detected
        ) {
          cfg.headerRowConfig[fileName] = cfg.headerRowConfig[fileName] || {};
          cfg.headerRowConfig[filePath] = cfg.headerRowConfig[filePath] || {};
          cfg.headerRowConfig[fileName][sheetName] = detected;
          cfg.headerRowConfig[filePath][sheetName] = detected;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
          // Invalidate any cached reads for this workbook so new header is picked up
          try {
            invalidateCache(filePath);
          } catch (e) {}
          log("INFO", "Persisted detected headerRow into config", {
            filePath,
            sheetName,
            detected,
          });
        }
      } catch (e) {
        // ignore persistence errors
      }
      return detected;
    }

    // If detection failed, find the first non-empty row and treat it as header
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 200); r++) {
      let nonEmpty = 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ c, r })];
        const raw = cell && cell.v != null ? String(cell.v).trim() : null;
        if (raw && raw !== "") nonEmpty++;
      }
      if (nonEmpty > 0) return r;
    }
  } catch (e) {
    // fall through to default
  }

  // Default to row 0 (0-based index)
  return 0;
}

// Heuristic to detect header row within a worksheet range
function detectHeaderRow(ws, range) {
  // Limit how many top rows to inspect to avoid scanning huge blank areas
  const maxInspectRows = Math.min(range.e.r, 50);

  let bestRow = null;
  let bestScore = -Infinity;

  for (let r = range.s.r; r <= maxInspectRows; r++) {
    let nonEmpty = 0;
    let numericCount = 0;
    const strings = [];

    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ c, r })];
      const raw = cell && cell.v != null ? cell.v : null;
      if (raw == null || String(raw).toString().trim() === "") continue;
      nonEmpty++;
      if (typeof raw === "number" || (cell && cell.t === "n")) numericCount++;
      else strings.push(String(raw).trim());
    }

    if (nonEmpty < 2) continue; // unlikely to be header

    const uniqueStrings = new Set(strings.map((s) => s.toLowerCase()));
    const duplicatePenalty = nonEmpty - uniqueStrings.size;

    // Look at next row to see if it appears like data (numbers/mixed types)
    let nextNonEmpty = 0;
    let nextNumeric = 0;
    if (r + 1 <= range.e.r) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ c, r: r + 1 })];
        const raw = cell && cell.v != null ? cell.v : null;
        if (raw == null || String(raw).trim() === "") continue;
        nextNonEmpty++;
        if (typeof raw === "number" || (cell && cell.t === "n")) nextNumeric++;
      }
    }

    // Scoring heuristics
    // - more non-empty cells is better
    // - more unique string values is better
    // - headers usually have fewer numeric cells
    // - following row having numbers suggests header above
    let score = 0;
    score += nonEmpty * 3;
    score += uniqueStrings.size * 2;
    score -= duplicatePenalty * 2;
    score -= numericCount * 1;
    if (nextNumeric > Math.max(1, Math.floor(nonEmpty / 4))) score += 6;
    if (nextNonEmpty > nonEmpty) score += 2;

    // Small penalty if strings are very long (unlikely for header names)
    const avgLen = strings.length
      ? strings.join(" ").length / strings.length
      : 0;
    if (avgLen > 40) score -= 2;

    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  // Require a minimum score to consider detection reliable
  if (bestScore !== -Infinity && bestScore >= 8) return bestRow;
  return null;
}

// Heuristic to detect whether a candidate header row actually looks like data
function isLikelyDataRow(values) {
  if (!values || values.length === 0) return false;
  let numericOrId = 0;
  const uuidRe =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const intRe = /^\d+$/;
  for (const v of values) {
    if (!v) continue;
    const s = String(v).trim();
    if (s === "") continue;
    if (intRe.test(s)) numericOrId++;
    else if (uuidRe.test(s)) numericOrId++;
    else if (!isNaN(Number(s)) && s.length > 0) numericOrId++;
  }
  // If more than half of non-empty values look numeric/ids, treat as data row
  const nonEmpty = values.filter(
    (v) => v != null && String(v).trim() !== ""
  ).length;
  return nonEmpty > 0 && numericOrId >= Math.ceil(nonEmpty / 2);
}

// Workbook metadata
function getWorkbookMeta(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { error: "not-found" };

  try {
    const cfg = readConfig() || {};
    const ignoreSheets = cfg.ignoreSheets || [];
    const wb = XLSX.readFile(filePath, { bookVBA: true, cellStyles: true });

    if (!wb || !wb.SheetNames || !Array.isArray(wb.SheetNames)) {
      return { error: "parse-error" };
    }

    // Respect workbook-level hidden flags: if a sheet is marked hidden (1)
    // or veryHidden (2) in the workbook XML, treat it as unavailable for display
    // unless explicitly listed in ignoreSheets.
    const workbookSheets = (wb && wb.Workbook && wb.Workbook.Sheets) || [];
    const hiddenSheetsFromConfig = (cfg && cfg.hiddenSheets) || [];

    const visibleSheetNames = wb.SheetNames.map((name, idx) => ({
      name,
      info: workbookSheets[idx] || {},
    }))
      .filter(({ name, info }) => {
        const hidden = info && info.Hidden;
        // Hidden values: 0 = visible, 1 = hidden, 2 = veryHidden
        if (hidden === 1 || hidden === 2) {
          log("INFO", "Skipping hidden workbook sheet", {
            filePath,
            sheetName: name,
            hidden,
          });
          return false;
        }
        // Respect user-configured hiddenSheets list
        if (hiddenSheetsFromConfig.includes(name)) {
          log("INFO", "Skipping sheet per config.hiddenSheets", {
            filePath,
            sheetName: name,
          });
          return false;
        }
        return !ignoreSheets.includes(name);
      })
      .map((s) => s.name);

    const sheets = visibleSheetNames.map((name) => {
      try {
        const ws = wb.Sheets[name];
        if (!ws || !ws["!ref"]) {
          return { name, columns: [], rows: 0, unavailable: true };
        }

        const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
        let headerRow = getHeaderRowPosition(filePath, name);

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

        // If configured header row looks like data, attempt detection
        const configuredVals = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
          configuredVals.push(cell ? cell.v : null);
        }
        if (isLikelyDataRow(configuredVals)) {
          const detected = detectHeaderRow(ws, range);
          if (detected != null && detected !== headerRow) {
            // override headerRow for display
            headerRow = detected;
          }
        }

        const headers = [];
        const seen = new Set();

        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
          let val = cell ? String(cell.v).trim() : "";
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

        // If no headers found, attempt to detect a better header row and persist it
        if (headers.length === 0) {
          try {
            const detected = detectHeaderRow(ws, range);
            if (detected != null && detected !== headerRow) {
              try {
                const cfg = readConfig() || {};
                cfg.headerRowConfig = cfg.headerRowConfig || {};
                cfg.headerRowConfig[fileName] =
                  cfg.headerRowConfig[fileName] || {};
                cfg.headerRowConfig[fileName][name] = detected;
                fs.writeFileSync(
                  CONFIG_PATH,
                  JSON.stringify(cfg, null, 2),
                  "utf8"
                );
                try {
                  invalidateCache(filePath);
                } catch (e) {}
                log(
                  "INFO",
                  "Persisted detected headerRow from getWorkbookMeta",
                  { filePath, sheetName: name, from: headerRow, to: detected }
                );
              } catch (e) {}
              headerRow = detected;

              // rebuild headers from detected row
              headers.length = 0;
              seen.clear();
              for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
                let val = cell ? String(cell.v).trim() : "";
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
            }

            // If still no headers, attempt a simple downward scan to find first row with content
            if (headers.length === 0) {
              for (
                let r = Math.max(range.s.r, headerRow);
                r <= Math.min(range.e.r, headerRow + 50);
                r++
              ) {
                let nonEmpty = 0;
                for (let C = range.s.c; C <= range.e.c; ++C) {
                  const cell = ws[XLSX.utils.encode_cell({ c: C, r })];
                  const raw =
                    cell && cell.v != null ? String(cell.v).trim() : null;
                  if (raw && raw !== "") nonEmpty++;
                }
                if (nonEmpty >= 2) {
                  try {
                    const cfg = readConfig() || {};
                    cfg.headerRowConfig = cfg.headerRowConfig || {};
                    cfg.headerRowConfig[fileName] =
                      cfg.headerRowConfig[fileName] || {};
                    cfg.headerRowConfig[fileName][name] = r;
                    fs.writeFileSync(
                      CONFIG_PATH,
                      JSON.stringify(cfg, null, 2),
                      "utf8"
                    );
                    try {
                      invalidateCache(filePath);
                    } catch (e) {}
                    log(
                      "INFO",
                      "Persisted fallback headerRow from downward scan",
                      { filePath, sheetName: name, from: headerRow, to: r }
                    );
                  } catch (e) {}
                  headerRow = r;
                  // rebuild headers
                  headers.length = 0;
                  seen.clear();
                  for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cell =
                      ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
                    let val = cell ? String(cell.v).trim() : "";
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
                  break;
                }
              }
            }
          } catch (e) {
            // ignore detection errors
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
          stack: sheetError.stack,
        });
        return {
          name,
          columns: [],
          rows: 0,
          unavailable: true,
          error: sheetError.message,
          errorStack: sheetError.stack,
        };
      }
    });

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
    let headerRow = getHeaderRowPosition(filePath, sheetName);

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

    // Validate configured header: if it looks like data, attempt detection and persist
    try {
      const configuredVals = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
        configuredVals.push(cell ? cell.v : null);
      }
      if (isLikelyDataRow(configuredVals)) {
        const detected = detectHeaderRow(ws, range);
        if (detected != null && detected !== headerRow) {
          // persist the better header row
          try {
            const cfg = readConfig() || {};
            cfg.headerRowConfig = cfg.headerRowConfig || {};
            const base = path.basename(filePath);
            cfg.headerRowConfig[base] = cfg.headerRowConfig[base] || {};
            cfg.headerRowConfig[filePath] = cfg.headerRowConfig[filePath] || {};
            cfg.headerRowConfig[base][sheetName] = detected;
            cfg.headerRowConfig[filePath][sheetName] = detected;
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
            try {
              invalidateCache(filePath);
            } catch (e) {}
            log("INFO", "Corrected headerRow persisted for sheet", {
              filePath,
              sheetName,
              detected,
            });
            headerRow = detected;
          } catch (e) {}
        }
      }
    } catch (e) {}

    // Build a raw header array aligned to worksheet columns (null for empty header cells)
    const rawHeaders = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
      const val = cell && cell.v != null ? String(cell.v).trim() : "";
      rawHeaders.push(val === "" ? null : val);
    }

    // Find the minimal contiguous span that contains any non-empty header values
    let firstNonEmpty = -1;
    let lastNonEmpty = -1;
    for (let i = 0; i < rawHeaders.length; i++) {
      if (rawHeaders[i] != null) {
        if (firstNonEmpty === -1) firstNonEmpty = i;
        lastNonEmpty = i;
      }
    }

    // Respect config option for header trimming/sliding window
    const uiCfg = (cfg && cfg.ui) || {};
    const headerTrimOpts = uiCfg.headerTrim || {
      enableTrim: true,
      useSlidingWindow: true,
    };

    const headerUtils = require(path.join(__dirname, "headerUtils.js"));
    const compact = headerUtils.compactHeaders(rawHeaders, headerTrimOpts);
    const headers = compact.headers || [];
    const seenHeaders = new Set();

    // If we found too few headers (for example a single stray header far to the right),
    // attempt a fallback detection: run detectHeaderRow and a simple downward scan
    // to find the first row with multiple non-empty cells. This handles malformed
    // sheets where persisted headerRow is incorrect.
    if (headers.length <= 1) {
      try {
        const detected = detectHeaderRow(ws, range);
        if (detected != null && detected !== headerRow) {
          headerRow = detected;
          // rebuild headers
          headers.length = 0;
          seenHeaders.clear();
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
            let val = cell ? String(cell.v).trim() : "";
            if (val) {
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
        }

        // If still too few headers, do a simple downward scan to find a row
        // with at least two non-empty cells and use that as header.
        if (headers.length <= 1) {
          for (
            let r = Math.max(range.s.r, headerRow);
            r <= Math.min(range.e.r, headerRow + 50);
            r++
          ) {
            let nonEmpty = 0;
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cell = ws[XLSX.utils.encode_cell({ c: C, r })];
              const raw = cell && cell.v != null ? String(cell.v).trim() : null;
              if (raw && raw !== "") nonEmpty++;
            }
            if (nonEmpty >= 2) {
              headerRow = r;
              headers.length = 0;
              seenHeaders.clear();
              for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
                let val = cell ? String(cell.v).trim() : "";
                if (val) {
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
              // Persist fallback detection
              try {
                const cfg = readConfig() || {};
                cfg.headerRowConfig = cfg.headerRowConfig || {};
                cfg.headerRowConfig[fileName] =
                  cfg.headerRowConfig[fileName] || {};
                cfg.headerRowConfig[fileName][sheetName] = headerRow;
                fs.writeFileSync(
                  CONFIG_PATH,
                  JSON.stringify(cfg, null, 2),
                  "utf8"
                );
                try {
                  invalidateCache(filePath);
                } catch (e) {}
                log(
                  "INFO",
                  "Persisted fallback headerRow from readSheet scan",
                  {
                    filePath,
                    sheetName,
                    detected: headerRow,
                  }
                );
              } catch (e) {}
              break;
            }
          }
        }
      } catch (e) {
        // ignore detection errors and continue
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

    // Detect which header columns contain formulas in the underlying worksheet
    const formulaColumns = [];
    try {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const header = headers[c - range.s.c];
        if (!header) continue;
        let found = false;
        for (let r = dataStartRow; r <= range.e.r; r++) {
          const addr = XLSX.utils.encode_cell({ c, r });
          const cell = ws[addr];
          if (cell && cell.f) {
            found = true;
            break;
          }
        }
        if (found) formulaColumns.push(header);
      }
    } catch (e) {
      // ignore detection errors
    }

    const result = { rows, total, page, pageSize, headers, formulaColumns };

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
    // Read with bookVBA and cellStyles so any VBA streams and styles are preserved
    const wb = XLSX.readFile(filePath, { bookVBA: true, cellStyles: true });
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

// Prepare rows for writing to a sheet: strip internal fields (those starting with `_`)
// but keep the primary key column (pkName) so it can be visible if the sheet has that header.
function sanitizeRowsForSheet(rows, pkName, headers) {
  if (!Array.isArray(rows)) return rows;
  const hasPkHeader = Array.isArray(headers) && headers.includes(pkName);
  return rows.map((r) => {
    const out = {};
    for (const k of Object.keys(r || {})) {
      // By default skip internal underscore-prefixed fields to avoid creating
      // __EMPTY columns. However, if the sheet headers explicitly include an
      // underscore-prefixed column (for example "_version"), preserve that
      // field so it can be written back to the workbook.
      if (k && k[0] === "_") {
        const headerIncludes = Array.isArray(headers) && headers.includes(k);
        if (!headerIncludes) continue;
      }

      // only include pk if the sheet headers include it; otherwise skip to avoid __EMPTY columns
      if (k === pkName && !hasPkHeader) continue;

      out[k] = r[k];
    }
    return out;
  });
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
    // Always request cellStyles preservation; only enable bookVBA for xlsm
    const writeOpts = { bookType: bookType, cellStyles: true };
    if (bookType === "xlsm") {
      writeOpts.bookVBA = true;
    }
    XLSX.writeFile(workbook, tmp, writeOpts);
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
        wb: XLSX.readFile(filePath, { bookVBA: true, cellStyles: true }),
        json: [],
      };

      const wb = r.wb;
      const ws = wb.Sheets[sheetName];

      // determine header row and headers
      const headerRowPos = getHeaderRowPosition(filePath, sheetName) || 0;
      const range =
        ws && ws["!ref"]
          ? XLSX.utils.decode_range(ws["!ref"])
          : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

      // read headers from the sheet at headerRowPos if possible
      const headers = [];
      if (ws && ws["!ref"]) {
        const seen = new Set();
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRowPos })];
          let val = cell ? String(cell.v).trim() : "";
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
      }

      // determine data start row (one after headerRowPos)
      const dataStart = headerRowPos + 1;

      // build existing data array using headers if present
      let existingData = [];
      if (headers.length > 0 && ws && ws["!ref"]) {
        existingData = XLSX.utils.sheet_to_json(ws, {
          defval: null,
          range: dataStart,
          header: headers,
        });
      } else {
        existingData = r.json || [];
      }

      ensurePkAndVersion(existingData, pkName);

      const newRow = Object.assign({}, row);
      if (!newRow[pkName]) newRow[pkName] = uuidv4();
      newRow["_version"] = 1;
      newRow["_created_at"] = new Date().toISOString();
      newRow["_created_by"] = opts.user || "system";

      // Prevent duplicate insertion: if a row with same PK exists, replace it.
      const existingIdx = existingData.findIndex(
        (r) => String(r[pkName]) === String(newRow[pkName])
      );
      if (existingIdx !== -1) {
        existingData[existingIdx] = newRow;
        log("WARN", "Row with same PK already existed - replaced", {
          filePath,
          sheetName,
          pk: newRow[pkName],
          index: existingIdx,
        });
      } else {
        // If caller provided an insertIndex, insert at that position within the data
        // (0-based relative to the first data row). Otherwise append as before.
        const insertIndex =
          typeof (opts && opts.insertIndex) === "number"
            ? Number(opts.insertIndex)
            : null;
        if (insertIndex !== null && !Number.isNaN(insertIndex)) {
          const idx = Math.max(0, Math.min(existingData.length, insertIndex));
          existingData.splice(idx, 0, newRow);
          log("INFO", "Row created and inserted at index", {
            filePath,
            sheetName,
            insertIndex: idx,
            pk: newRow[pkName],
          });
        } else {
          existingData.push(newRow);
        }
      }

      // sanitize rows before writing to sheet to avoid creating __EMPTY* columns for internal fields
      const sanitizedData = sanitizeRowsForSheet(existingData, pkName, headers);
      // create a worksheet for the data rows only
      const dataWs = XLSX.utils.json_to_sheet(sanitizedData, {
        header: headers.length > 0 ? headers : undefined,
      });

      // build a full worksheet by preserving top rows through headerRowPos and appending data
      let fullWs;
      try {
        // copy top rows by cloning cell objects to preserve formulas/styles/comments
        const newWs = {};
        const cols = range.e.c - range.s.c + 1;
        const rowsCount = headerRowPos - range.s.r + 1;
        for (let rIdx = range.s.r; rIdx <= headerRowPos; rIdx++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ c, r: rIdx });
            const cell = ws[addr];
            if (cell) {
              // shallow clone the cell object to new worksheet
              newWs[addr] = Object.assign({}, cell);
            }
          }
        }

        // attach merges if present
        if (ws && ws["!merges"]) newWs["!merges"] = ws["!merges"];

        // now append data rows starting at dataStart
        if (headers.length > 0) {
          XLSX.utils.sheet_add_json(newWs, sanitizedData, {
            origin: dataStart,
            skipHeader: true,
            header: headers,
          });
        } else {
          XLSX.utils.sheet_add_json(newWs, sanitizedData, { origin: 0 });
        }

        // Preserve existing formula cells in the data area: if the original worksheet
        // has a formula at a data cell, restore that cell object so we don't overwrite formulas.
        try {
          const dataRowsCount = Array.isArray(sanitizedData)
            ? sanitizedData.length
            : 0;
          for (let rIdx = dataStart; rIdx < dataStart + dataRowsCount; rIdx++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ c, r: rIdx });
              const origCell = ws[addr];
              if (origCell && origCell.f) {
                newWs[addr] = Object.assign({}, origCell);
              }
            }
          }
        } catch (e) {
          // non-fatal; if preservation fails, proceed with written data
        }

        fullWs = newWs;
      } catch (e) {
        // fallback: full replacement
        const headersFallback = Array.from(
          new Set([].concat(...existingData.map(Object.keys)))
        );
        fullWs = XLSX.utils.json_to_sheet(existingData, {
          header: headersFallback,
        });
      }

      wb.Sheets[sheetName] = fullWs;

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
        wb: XLSX.readFile(filePath, { bookVBA: true, cellStyles: true }),
        json: [],
      };

      const wb = r.wb;
      const ws = wb.Sheets[sheetName];

      const headerRowPos = getHeaderRowPosition(filePath, sheetName) || 0;
      const range =
        ws && ws["!ref"]
          ? XLSX.utils.decode_range(ws["!ref"])
          : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

      // read existing data rows below header
      let json = [];
      const headers = [];
      if (ws && ws["!ref"]) {
        const seen = new Set();
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRowPos })];
          let val = cell ? String(cell.v).trim() : "";
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
        const dataStart = headerRowPos + 1;
        if (headers.length > 0)
          json = XLSX.utils.sheet_to_json(ws, {
            defval: null,
            range: dataStart,
            header: headers,
          });
      }

      if (!json || json.length === 0) json = r.json || [];

      let idx = -1;
      if (pkValue !== undefined && pkValue !== null && String(pkValue) !== "") {
        idx = json.findIndex((r) => String(r[pkName]) === String(pkValue));
      }

      // If pkValue not provided or not found, allow index-based update when caller supplied an index
      if (idx === -1 && opts && typeof opts.index === "number") {
        const providedIndex = Number(opts.index);
        if (providedIndex >= 0 && providedIndex < json.length) {
          idx = providedIndex;
          log("INFO", "Using index-based update fallback", {
            filePath,
            sheetName,
            providedIndex,
          });
        }
      }

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

      // sanitize rows to avoid writing internal underscore-prefixed fields
      const sanitized = sanitizeRowsForSheet(json, pkName, headers);

      // Try a safe in-place update when possible: update only the specific cell objects
      // This avoids rebuilding the entire data area which can shift formatting or rows.
      try {
        const updatableKeys = Object.keys(updates || {}).filter(
          (k) => k && k[0] !== "_" && k !== pkName
        );
        const hasAllHeaders = Array.isArray(headers)
          ? updatableKeys.every((k) => headers.includes(k))
          : false;

        if (headers.length > 0 && hasAllHeaders) {
          const dataStart = headerRowPos + 1;
          const targetRow = dataStart + idx;
          let anyUpdated = false;

          for (const key of updatableKeys) {
            const colIndex = headers.indexOf(key) + range.s.c;
            if (colIndex < range.s.c || colIndex > range.e.c) continue;
            const addr = XLSX.utils.encode_cell({ c: colIndex, r: targetRow });
            const origCell = ws && ws[addr];
            const newVal = updates[key];

            // Do not overwrite formula cells
            if (origCell && origCell.f) continue;

            // If value is null/undefined/empty, remove the cell to avoid stale data
            if (newVal === null || newVal === undefined || newVal === "") {
              if (ws && ws[addr]) {
                delete ws[addr];
                anyUpdated = true;
              }
              continue;
            }

            const newCell = origCell ? Object.assign({}, origCell) : {};
            newCell.v = newVal;
            // Set cell type according to the new value regardless of original type
            const newType = typeof newVal === "number" ? "n" : "s";
            newCell.t = newType;
            // If changing from numeric to string, remove numeric format to avoid NaN when reading
            if (origCell && origCell.t === "n" && newType === "s") {
              delete newCell.z;
            }
            // Ensure we don't accidentally set a formula
            delete newCell.f;

            if (!wb || !wb.Sheets) continue;
            wb.Sheets[sheetName] = ws;
            ws[addr] = newCell;
            anyUpdated = true;
          }

          if (anyUpdated) {
            // Also persist the incremented _version into the worksheet if the
            // sheet exposes a "_version" header so the on-disk workbook reflects
            // the optimistic concurrency bump.
            try {
              if (Array.isArray(headers) && headers.includes("_version")) {
                const verColIndex = headers.indexOf("_version") + range.s.c;
                const verAddr = XLSX.utils.encode_cell({
                  c: verColIndex,
                  r: targetRow,
                });
                const verCell =
                  ws && ws[verAddr] ? Object.assign({}, ws[verAddr]) : {};
                verCell.v = updated["_version"];
                verCell.t = typeof verCell.v === "number" ? "n" : "s";
                // ensure no formula is present on the version cell
                delete verCell.f;
                // if changing from numeric to string, remove numeric format
                if (
                  ws &&
                  ws[verAddr] &&
                  ws[verAddr].t === "n" &&
                  verCell.t === "s"
                ) {
                  delete verCell.z;
                }
                ws[verAddr] = verCell;
              }
            } catch (e) {
              // non-fatal; proceed to write whatever we updated
            }

            const ext = path.extname(filePath).toLowerCase().replace(".", "");
            const bookType = ext === "xlsm" ? "xlsm" : "xlsx";
            writeWorkbookAtomic(filePath, wb, bookType);
            invalidateCache(filePath);
            log("INFO", "Row updated (in-place)", {
              filePath,
              sheetName,
              pkValue,
              updates,
            });
            return { success: true, row: updated };
          }
        }
      } catch (e) {
        // any error here should fall back to the full-rebuild path below
      }

      // rebuild full worksheet preserving top rows and header row (clone full cell objects)
      let fullWs;
      try {
        const newWs = {};
        const dataStart = headerRowPos + 1;
        for (let rIdx = range.s.r; rIdx <= headerRowPos; rIdx++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ c, r: rIdx });
            const cell = ws[addr];
            if (cell) {
              // shallow clone the cell object to preserve formulas/styles/comments
              newWs[addr] = Object.assign({}, cell);
            }
          }
        }

        // attach merges if present
        if (ws && ws["!merges"]) newWs["!merges"] = ws["!merges"];

        // now append data rows starting at dataStart (use sanitized rows)
        if (headers.length > 0) {
          XLSX.utils.sheet_add_json(newWs, sanitized, {
            origin: dataStart,
            skipHeader: true,
            header: headers,
          });
        } else {
          XLSX.utils.sheet_add_json(newWs, sanitized, { origin: 0 });
        }

        // Restore formula cells from original worksheet in the data area to avoid overwriting formulas
        try {
          const dataRowsCount = Array.isArray(sanitized) ? sanitized.length : 0;
          for (let rIdx = dataStart; rIdx < dataStart + dataRowsCount; rIdx++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ c, r: rIdx });
              const origCell = ws[addr];
              if (origCell && origCell.f) {
                newWs[addr] = Object.assign({}, origCell);
              }
            }
          }
        } catch (e) {
          // ignore
        }

        // Restore formula cells from original worksheet in the data area to avoid overwriting formulas
        try {
          const dataRowsCount = Array.isArray(sanitized) ? sanitized.length : 0;
          for (let rIdx = dataStart; rIdx < dataStart + dataRowsCount; rIdx++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ c, r: rIdx });
              const origCell = ws[addr];
              if (origCell && origCell.f) {
                newWs[addr] = Object.assign({}, origCell);
              }
            }
          }
        } catch (e) {
          // ignore
        }

        fullWs = newWs;
      } catch (e) {
        const headersFallback = Array.from(
          new Set([].concat(...sanitized.map(Object.keys)))
        );
        fullWs = XLSX.utils.json_to_sheet(sanitized, {
          header: headersFallback,
        });
      }

      wb.Sheets[sheetName] = fullWs;

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
        wb: XLSX.readFile(filePath, { bookVBA: true, cellStyles: true }),
        json: [],
      };

      const wb = r.wb;
      const ws = wb.Sheets[sheetName];

      const headerRowPos = getHeaderRowPosition(filePath, sheetName) || 0;
      const range =
        ws && ws["!ref"]
          ? XLSX.utils.decode_range(ws["!ref"])
          : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

      let json = [];
      const headers = [];
      if (ws && ws["!ref"]) {
        const seen = new Set();
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRowPos })];
          let val = cell ? String(cell.v).trim() : "";
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
        const dataStart = headerRowPos + 1;
        if (headers.length > 0)
          json = XLSX.utils.sheet_to_json(ws, {
            defval: null,
            range: dataStart,
            header: headers,
          });
      }

      if (!json || json.length === 0) json = r.json || [];

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

      // sanitize rows to avoid writing internal underscore-prefixed fields
      const sanitized = sanitizeRowsForSheet(json, pkName, headers);

      // rebuild full worksheet preserving header/top rows (clone full cell objects)
      let fullWs;
      try {
        const newWs = {};
        const dataStart = headerRowPos + 1;
        for (let rIdx = range.s.r; rIdx <= headerRowPos; rIdx++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ c, r: rIdx });
            const cell = ws[addr];
            if (cell) {
              // shallow clone the cell object to preserve formulas/styles/comments
              newWs[addr] = Object.assign({}, cell);
            }
          }
        }

        // attach merges if present
        if (ws && ws["!merges"]) newWs["!merges"] = ws["!merges"];

        // now append data rows starting at dataStart (use sanitized rows)
        if (headers.length > 0) {
          XLSX.utils.sheet_add_json(newWs, sanitized, {
            origin: dataStart,
            skipHeader: true,
            header: headers,
          });
        } else {
          XLSX.utils.sheet_add_json(newWs, sanitized, { origin: 0 });
        }

        fullWs = newWs;
      } catch (e) {
        const headersFallback = Array.from(
          new Set([].concat(...sanitized.map(Object.keys)))
        );
        fullWs = XLSX.utils.json_to_sheet(sanitized, {
          header: headersFallback,
        });
      }

      wb.Sheets[sheetName] = fullWs;

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
  detectHeaderRow,
  isLikelyDataRow,
  getHeaderRowPosition,
};
