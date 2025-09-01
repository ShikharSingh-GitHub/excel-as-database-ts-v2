#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");

const CONFIG_PATH = path.join(__dirname, "..", "config.json");

function usage() {
  console.log(
    "Usage: node scripts/migrate-to-data-sheet.js <file|folder> [--data-sheet NAME] [--source-sheet NAME] [--dry-run]"
  );
  console.log(
    "Creates a hidden data sheet (default: _data) in each workbook if missing and copies table data from a source sheet."
  );
}

function isExcelFile(f) {
  const lower = String(f || "").toLowerCase();
  return (
    (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) &&
    !path.basename(f).startsWith(".")
  );
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    return { dataSheetName: "_data", pkName: "id" };
  }
}

function listFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return isExcelFile(target) ? [target] : [];
  if (stat.isDirectory()) {
    return fs
      .readdirSync(target)
      .map((f) => path.join(target, f))
      .filter(isExcelFile);
  }
  return [];
}

function findSourceSheet(wb, preferred) {
  if (preferred && wb.SheetNames.includes(preferred)) return preferred;
  // prefer first visible non-system sheet
  for (const name of wb.SheetNames) {
    if (name && name.startsWith("_")) continue;
    if (name && name.toLowerCase() === "config") continue;
    return name;
  }
  // fallback to first sheet
  return wb.SheetNames[0];
}

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

function migrateFile(filePath, opts) {
  const cfg = readConfig();
  const dataSheetName = opts.dataSheet || cfg.dataSheetName || "_data";
  const pkName = cfg.pkName || "id";

  if (!fs.existsSync(filePath)) {
    console.error("Not found:", filePath);
    return { file: filePath, skipped: true };
  }

  const wb = XLSX.readFile(filePath, { bookVBA: true, cellStyles: true });
  if (
    !wb ||
    !wb.SheetNames ||
    !Array.isArray(wb.SheetNames) ||
    wb.SheetNames.length === 0
  ) {
    console.error("Invalid workbook:", filePath);
    return { file: filePath, skipped: true };
  }

  if (wb.SheetNames.includes(dataSheetName)) {
    console.log("Already has data sheet, skipping:", filePath);
    return { file: filePath, skipped: true };
  }

  const sourceName = opts.sourceSheet || findSourceSheet(wb);
  if (!sourceName || !wb.SheetNames.includes(sourceName)) {
    console.error("No valid source sheet found for", filePath);
    return { file: filePath, skipped: true };
  }

  console.log(
    `Migrating ${filePath} -> creating data sheet '${dataSheetName}' from '${sourceName}'`
  );

  const ws = wb.Sheets[sourceName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  ensurePkAndVersion(rows, pkName);

  const newWs = XLSX.utils.json_to_sheet(rows, { header: undefined });
  wb.SheetNames.push(dataSheetName);
  wb.Sheets[dataSheetName] = newWs;

  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Sheets = wb.Workbook.Sheets || [];
  wb.Workbook.Sheets.push({ name: dataSheetName, Hidden: 1 });

  const bak = `${filePath}.bak.${Date.now()}`;
  try {
    fs.copyFileSync(filePath, bak);
    console.log("Backup saved to", bak);
  } catch (e) {
    console.warn("Failed to write backup for", filePath, e.message);
  }

  if (opts.dryRun) {
    console.log("[dry-run] would write data sheet to", filePath);
    return { file: filePath, created: true, dryRun: true };
  }

  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const bookType = ext === "xlsm" ? "xlsm" : "xlsx";

  // For .xlsm files, avoid overwriting the original with SheetJS.
  // By default write an .xlsx sidecar next to the original. Use --force
  // to overwrite the original when the caller explicitly requests it.
  const force = opts.force || false;
  if (bookType === "xlsm") {
    if (!force) {
      const sidecar = `${filePath}.data.xlsx`;
      XLSX.writeFile(wb, sidecar, { bookType: "xlsx", cellStyles: true });
      console.log("Wrote data sheet sidecar to", sidecar);
      return { file: filePath, created: true, sidecar };
    }
    // If force specified, require explicit env override to proceed to overwrite
    if (!process.env.ALLOW_XLSM_OVERWRITE) {
      const sidecar = `${filePath}.data.xlsx`;
      XLSX.writeFile(wb, sidecar, { bookType: "xlsx", cellStyles: true });
      console.warn(
        "--force specified but ALLOW_XLSM_OVERWRITE not set; wrote sidecar instead to avoid destructive overwrite",
        sidecar
      );
      return { file: filePath, created: true, sidecar, forcedButSkipped: true };
    }
    // else fall through and overwrite as requested
  }

  // Non-xlsm or forced write: overwrite original
  XLSX.writeFile(wb, filePath, {
    bookType,
    cellStyles: true,
    bookVBA: bookType === "xlsm",
  });
  console.log("Wrote data sheet to", filePath);
  return { file: filePath, created: true };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(0);
  }

  const target = argv[0];
  const opts = { dataSheet: null, sourceSheet: null, dryRun: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--data-sheet" && argv[i + 1]) {
      opts.dataSheet = argv[++i];
    } else if (a === "--source-sheet" && argv[i + 1]) {
      opts.sourceSheet = argv[++i];
    } else if (a === "--dry-run") {
      opts.dryRun = true;
    }
  }

  const files = listFiles(target);
  if (!files || files.length === 0) {
    console.error("No workbook files found at target:", target);
    process.exit(1);
  }

  const results = [];
  for (const f of files) {
    try {
      const res = migrateFile(f, opts);
      results.push(res);
    } catch (e) {
      console.error("Migration failed for", f, e && e.message);
      results.push({ file: f, error: e && e.message });
    }
  }

  console.log("Migration complete. Summary:");
  console.table(
    results.map((r) => ({
      file: r.file,
      created: !!r.created,
      skipped: !!r.skipped,
      dryRun: !!r.dryRun,
      error: r.error || "",
    }))
  );
}

if (require.main === module) main();

module.exports = { migrateFile, listFiles };
