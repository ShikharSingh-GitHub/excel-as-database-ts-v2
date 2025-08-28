const path = require("path");
const fs = require("fs");
const svcPath = path.join(
  __dirname,
  "..",
  "src",
  "electron",
  "excelService.js"
);
if (!fs.existsSync(svcPath)) {
  console.error("excelService not found at", svcPath);
  process.exit(1);
}
const svc = require(svcPath);
const XLSX = require("xlsx");

const sample = path.join(__dirname, "..", "Sample.xlsm");
const sheetsToCheck = ["Application", "Test Set", "Test Set", "Test Case"];

function scoreRow(ws, range, r) {
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
  const uniqueStrings = new Set(strings.map((s) => s.toLowerCase()));
  const duplicatePenalty = nonEmpty - uniqueStrings.size;
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
  let score = 0;
  score += nonEmpty * 3;
  score += uniqueStrings.size * 2;
  score -= duplicatePenalty * 2;
  score -= numericCount * 1;
  if (nextNumeric > Math.max(1, Math.floor(nonEmpty / 4))) score += 6;
  if (nextNonEmpty > nonEmpty) score += 2;
  const avgLen = strings.length ? strings.join(" ").length / strings.length : 0;
  if (avgLen > 40) score -= 2;
  return {
    r,
    nonEmpty,
    numericCount,
    uniqueCount: uniqueStrings.size,
    nextNonEmpty,
    nextNumeric,
    score,
  };
}

(async () => {
  console.log("Using file:", sample);
  // print workbook meta
  try {
    const meta = svc.getWorkbookMeta ? svc.getWorkbookMeta(sample) : null;
    console.log("getWorkbookMeta output:");
    console.log(JSON.stringify(meta, null, 2));
  } catch (e) {
    console.error("getWorkbookMeta error", e.message);
  }

  let wb;
  try {
    wb = XLSX.readFile(sample);
  } catch (e) {
    console.error("Failed to read workbook:", e.message);
    process.exit(1);
  }

  for (const sheetName of sheetsToCheck) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.log(`Sheet: ${sheetName} -> not found`);
      continue;
    }
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    console.log(
      `\nSheet: ${sheetName} range: rows ${range.s.r}-${range.e.r}, cols ${range.s.c}-${range.e.c}`
    );

    // show top rows
    const maxShow = Math.min(range.e.r, range.s.r + 12);
    for (let r = range.s.r; r <= maxShow; r++) {
      const rowVals = [];
      for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 14); c++) {
        const cell = ws[XLSX.utils.encode_cell({ c, r })];
        rowVals.push(cell && cell.v != null ? String(cell.v) : "");
      }
      const s = scoreRow(ws, range, r);
      console.log(
        `row ${r} | score ${s.score} | nonEmpty ${s.nonEmpty} | nextNonEmpty ${s.nextNonEmpty} | vals:`,
        rowVals.slice(0, 12)
      );
    }

    // try service readSheet and show headers read
    try {
      const res = svc.readSheet(sample, sheetName, { page: 1, pageSize: 5 });
      console.log(`\nreadSheet result for ${sheetName}:`);
      console.log({
        error: res.error,
        headers: res.headers,
        rows: (res.rows || []).slice(0, 3).map((r) => Object.keys(r)),
      });
    } catch (e) {
      console.error("readSheet error for", sheetName, e.message);
    }
  }
})();
