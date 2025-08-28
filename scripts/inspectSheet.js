const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");
const svc = require(path.join(
  __dirname,
  "..",
  "src",
  "electron",
  "excelService.js"
));

const file = path.join(__dirname, "..", "End_To_End_Globalsqa1 (1).xlsm");
const sheet = "Test Set";

function dump() {
  if (!fs.existsSync(file)) return console.error("file not found", file);
  const wb = XLSX.readFile(file);
  if (!wb.SheetNames.includes(sheet))
    return console.error("sheet not found", sheet);
  const ws = wb.Sheets[sheet];
  console.log("!ref:", ws["!ref"]);
  const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
  console.log("range:", range);
  const headerPos = svc.getHeaderRowPosition(file, sheet);
  console.log("getHeaderRowPosition (0-based):", headerPos);

  if (range) {
    console.log("\nHeader row cells:");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddr = XLSX.utils.encode_cell({ c: C, r: headerPos });
      const cell = ws[cellAddr];
      console.log(cellAddr, "->", cell ? JSON.stringify(cell.v) : "<empty>");
    }

    console.log("\nData rows (AoA):");
    const aoa = [];
    for (let r = range.s.r; r <= range.e.r; ++r) {
      const rowArr = [];
      for (let c = range.s.c; c <= range.e.c; ++c) {
        const cell = ws[XLSX.utils.encode_cell({ c, r })];
        rowArr.push(cell && cell.v != null ? cell.v : null);
      }
      console.log("row", r, rowArr);
      aoa.push(rowArr);
    }

    console.log("\nsheet_to_json with header detection:");
    try {
      const headers = [];
      const seen = new Set();
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = ws[XLSX.utils.encode_cell({ c: C, r: headerPos })];
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
      console.log("headers array:", headers);
      const dataStart = headerPos + 1;
      console.log("dataStart:", dataStart);
      const json = XLSX.utils.sheet_to_json(ws, {
        defval: null,
        range: dataStart,
        header: headers,
      });
      console.log("sheet_to_json result length:", json.length);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.error("sheet_to_json error", e);
    }
  }
}

dump();
