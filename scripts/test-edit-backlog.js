const fs = require("fs");
const path = require("path");
const os = require("os");
const XLSX = require("xlsx");
const excelService = require("../src/electron/excelService");

function copyToTmp(src) {
  const base = path.basename(src);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xlsm-test-"));
  const dst = path.join(dir, base);
  fs.copyFileSync(src, dst);
  return dst;
}

function diffObjects(a, b) {
  const diffs = [];
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const va = a ? a[k] : undefined;
    const vb = b ? b[k] : undefined;
    if (String(va) !== String(vb)) {
      diffs.push({ key: k, before: va, after: vb });
    }
  }
  return diffs;
}

async function run(sampleFile) {
  if (!sampleFile || !fs.existsSync(sampleFile)) {
    console.error("Sample file not found:", sampleFile);
    process.exit(2);
  }

  const tmp = copyToTmp(sampleFile);
  console.log("Testing on copy:", tmp);

  // find a sheet named backlog (case-insensitive)
  const meta = excelService.getWorkbookMeta(tmp);
  if (!meta || !meta.sheets) {
    console.error("Failed to read workbook meta");
    process.exit(3);
  }
  const sheetEntry = meta.sheets.find((s) => /backlog/i.test(s.name));
  if (!sheetEntry) {
    console.error(
      "No sheet matching /backlog/i found. Available sheets:",
      meta.sheets.map((s) => s.name)
    );
    process.exit(4);
  }
  const sheetName = sheetEntry.name;
  console.log("Using sheet:", sheetName);

  // read sheet via readSheet to get headers and rows
  const listing = excelService.readSheet(tmp, sheetName, {
    page: 1,
    pageSize: 500,
  });
  if (!listing || listing.error) {
    console.error(
      "readSheet failed:",
      listing && listing.error,
      listing && listing.message
    );
    process.exit(5);
  }

  const headers = listing.headers || [];
  const rows = listing.rows || [];
  if (!rows || rows.length === 0) {
    console.error("No data rows found in sheet", sheetName);
    process.exit(6);
  }

  const pkName =
    (excelService.readConfig && excelService.readConfig().pkName) || "id";
  const first = rows[0];
  const pkValue = first[pkName];

  // pick a candidate column to edit: first header that's not pk, not formula, not underscore
  const formulaCols = listing.formulaColumns || [];
  const candidate = headers.find(
    (h) => h && h !== pkName && !h.startsWith("_") && !formulaCols.includes(h)
  );
  if (!candidate) {
    console.error("No suitable candidate column to edit (non-pk, non-formula)");
    process.exit(8);
  }

  console.log("Editing column:", candidate);

  // If we have a PK, use service updateRow; otherwise do a direct worksheet edit
  if (pkValue) {
    console.log("Found first row PK:", pkValue);
    // snapshot before
    const before = excelService.readSheetJson(tmp, sheetName);
    if (!before || !before.json) {
      console.error("Failed to read sheet JSON before edit");
      process.exit(9);
    }
    const beforeRow = before.json.find(
      (r) => String(r[pkName]) === String(pkValue)
    );

    // perform update
    const newVal = "TEST_EDIT_" + Date.now();
    const expectedVersion = first["_version"] || null;
    console.log("Attempting update:", {
      pk: pkValue,
      col: candidate,
      value: newVal,
      expectedVersion,
    });
    const res = await excelService.updateRow(
      tmp,
      sheetName,
      pkValue,
      { [candidate]: newVal },
      expectedVersion
    );
    console.log("updateRow result:", res);

    // snapshot after
    const after = excelService.readSheetJson(tmp, sheetName);
    const afterRow = after.json.find(
      (r) => String(r[pkName]) === String(pkValue)
    );

    // compute diffs on the row object
    const diffs = diffObjects(beforeRow || {}, afterRow || {});
    console.log("Row diffs (before -> after):");
    console.table(diffs);
    console.log("Test copy left at:", tmp);
    process.exit(0);
  } else {
    console.log(
      "No PK present; performing direct worksheet edit to simulate an app change"
    );
    const before = excelService.readSheetJson(tmp, sheetName);
    const wb = before.wb;
    const ws = before.ws;
    const headerRowPos =
      (excelService.getHeaderRowPosition &&
        excelService.getHeaderRowPosition(tmp, sheetName)) ||
      0;
    const range =
      ws && ws["!ref"]
        ? require("xlsx").utils.decode_range(ws["!ref"])
        : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
    const dataStart = headerRowPos + 1;
    // find first non-empty data row index
    const rowIdx = dataStart;
    const colIndex = headers.indexOf(candidate) + range.s.c;
    const addr = require("xlsx").utils.encode_cell({ c: colIndex, r: rowIdx });
    const orig = ws[addr];
    const newVal = "TEST_EDIT_" + Date.now();
    const newCell = orig ? Object.assign({}, orig) : {};
    newCell.v = newVal;
    newCell.t = typeof newVal === "number" ? "n" : "s";
    if (orig && orig.t === "n" && newCell.t === "s") delete newCell.z;
    delete newCell.f;
    ws[addr] = newCell;
    // write workbook
    const ext = path.extname(tmp).toLowerCase().replace(".", "");
    const writeOpts = { cellStyles: true };
    if (ext === "xlsm") writeOpts.bookVBA = true;
    XLSX.writeFile(wb, tmp, writeOpts);

    const after = excelService.readSheetJson(tmp, sheetName);
    const beforeRow = before.json && before.json[0];
    const afterRow = after.json && after.json[0];
    const diffs = diffObjects(beforeRow || {}, afterRow || {});
    console.log("Row diffs (before -> after):");
    console.table(diffs);
    console.log("Test copy left at:", tmp);
    process.exit(0);
  }
}

if (require.main === module) {
  const arg = process.argv[2];
  run(arg).catch((e) => {
    console.error("Error during test:", (e && e.stack) || e);
    process.exit(1);
  });
}
