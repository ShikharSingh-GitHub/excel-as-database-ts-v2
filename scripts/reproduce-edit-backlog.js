const fs = require("fs");
const path = require("path");
const os = require("os");
const XLSX = require("xlsx");

function copyToTmp(src) {
  const base = path.basename(src);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xlsm-edit-"));
  const dst = path.join(dir, base);
  fs.copyFileSync(src, dst);
  return dst;
}

function detectHeaderRow(ws, range) {
  if (!ws || !range) return 0;
  let best = { row: 0, count: 0 };
  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 50); r++) {
    let nonEmpty = 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ c, r })];
      if (cell && cell.v != null && String(cell.v).trim() !== "") nonEmpty++;
    }
    if (nonEmpty > best.count) best = { row: r, count: nonEmpty };
  }
  return best.row;
}

function buildHeaders(ws, range, headerRow) {
  const headers = [];
  const seen = new Set();
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerRow })];
    let val = cell && cell.v != null ? String(cell.v).trim() : "";
    if (val) {
      let orig = val;
      let i = 1;
      while (seen.has(val)) {
        val = `${orig} (${i})`;
        i++;
      }
      seen.add(val);
      headers.push(val);
    } else {
      headers.push(null);
    }
  }
  return headers;
}

function rowCells(ws, range, headerOffset, rowIndex) {
  const out = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const header = headerOffset[c - range.s.c];
    const addr = XLSX.utils.encode_cell({ c, r: rowIndex });
    const cell = ws[addr];
    out[header || `__col_${c}`] = cell
      ? { v: cell.v, f: cell.f, s: cell.s }
      : null;
  }
  return out;
}

if (require.main === module) {
  const sample = process.argv[2];
  if (!sample || !fs.existsSync(sample)) {
    console.error(
      "Usage: node scripts/reproduce-edit-backlog.js <workbook.xlsm>"
    );
    process.exit(2);
  }

  const copy = copyToTmp(sample);
  console.log("Working copy:", copy);

  const wb = XLSX.readFile(copy, { bookVBA: true, cellStyles: true });
  const sheets = wb.SheetNames;
  const sheetName = sheets.find((s) => /backlog/i.test(s)) || sheets[0];
  console.log("Target sheet:", sheetName);
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws["!ref"]) {
    console.error("Sheet has no range");
    process.exit(3);
  }
  const range = XLSX.utils.decode_range(ws["!ref"]);

  const headerRow = detectHeaderRow(ws, range);
  console.log("Detected header row (0-index):", headerRow);
  const headers = buildHeaders(ws, range, headerRow);
  console.log("First headers:", headers.slice(0, 10));

  const dataStart = headerRow + 1;
  const json = XLSX.utils.sheet_to_json(ws, {
    defval: null,
    range: dataStart,
    header: headers,
  });
  if (!json || json.length === 0) {
    console.error("No data rows found");
    process.exit(4);
  }

  const pkName = headers.includes("id") ? "id" : null;
  const targetRowIdx = 0; // first data row
  const targetRow = json[targetRowIdx];
  console.log("Target row PK (if any):", pkName ? targetRow[pkName] : "(none)");

  // choose candidate column: first header that's not pk, not null, not underscore-prefixed, not formula
  const formulaCols = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const hdr = headers[c - range.s.c];
    if (!hdr) continue;
    for (let r = dataStart; r <= Math.min(dataStart + 50, range.e.r); r++) {
      const cell = ws[XLSX.utils.encode_cell({ c, r })];
      if (cell && cell.f) {
        formulaCols.push(hdr);
        break;
      }
    }
  }

  const candidate = headers.find(
    (h) => h && h !== pkName && !h.startsWith("_") && !formulaCols.includes(h)
  );
  if (!candidate) {
    console.error("No suitable candidate column");
    process.exit(5);
  }
  console.log("Candidate column to edit:", candidate);

  // snapshot before
  const beforeCells = rowCells(ws, range, headers, dataStart + targetRowIdx);

  // perform update on the worksheet cell directly
  const colIndex = headers.indexOf(candidate) + range.s.c;
  const targetAddr = XLSX.utils.encode_cell({
    c: colIndex,
    r: dataStart + targetRowIdx,
  });
  console.log("Target cell address:", targetAddr);
  const origCell = ws[targetAddr];
  const newVal = "REPRO_EDIT_" + Date.now();
  const newCell = origCell ? Object.assign({}, origCell) : {};
  newCell.v = newVal;
  // Force cell type to string when writing a string value
  newCell.t = typeof newVal === "number" ? "n" : "s";
  // If converting from numeric to string, remove numeric format to avoid NaN
  if (origCell && origCell.t === "n" && newCell.t === "s") {
    delete newCell.z;
  }
  delete newCell.f;
  ws[targetAddr] = newCell;

  // write workbook back
  const ext = path.extname(copy).toLowerCase().replace(".", "");
  const bookType = ext === "xlsm" ? "xlsm" : "xlsx";
  // Safe write: if target is .xlsm, write a .data.xlsx sidecar instead of overwriting
  const targetWrite = bookType === "xlsm" ? `${copy}.data.xlsx` : copy;
  const writeArgs =
    bookType === "xlsm"
      ? { bookType: "xlsx", cellStyles: true }
      : { bookType, cellStyles: true, bookVBA: true };
  XLSX.writeFile(wb, targetWrite, writeArgs);

  // re-open and compare
  const readBack = bookType === "xlsm" ? `${copy}.data.xlsx` : copy;
  const wb2 = XLSX.readFile(readBack, {
    bookVBA: bookType !== "xlsm",
    cellStyles: true,
  });
  const ws2 = wb2.Sheets[sheetName];
  const afterCells = rowCells(ws2, range, headers, dataStart + targetRowIdx);

  console.log("Before vs After diffs:");
  for (const k of Object.keys(beforeCells)) {
    const a = beforeCells[k];
    const b = afterCells[k];
    const av = a ? (a.v === undefined ? null : a.v) : null;
    const bv = b ? (b.v === undefined ? null : b.v) : null;
    if (String(av) !== String(bv)) {
      console.log(`- ${k}:`, {
        before: av,
        after: bv,
        beforeFormula: a && a.f,
        afterFormula: b && b.f,
      });
    }
  }

  // check formulas presence in sheet for first 20 columns
  console.log("Formula status for first headers:");
  for (let i = 0; i < Math.min(headers.length, 20); i++) {
    const hdr = headers[i];
    if (!hdr) continue;
    let found = false;
    for (let r = dataStart; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ c: range.s.c + i, r });
      const cell = ws2[addr];
      if (cell && cell.f) {
        found = true;
        break;
      }
    }
    console.log(`  ${hdr}: ${found ? "has formula" : "no formula"}`);
  }

  console.log("Edited file left at:", copy);
}
