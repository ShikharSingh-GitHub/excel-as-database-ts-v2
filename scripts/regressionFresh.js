const path = require("path");
const svc = require(path.join(
  __dirname,
  "..",
  "src",
  "electron",
  "excelService.js"
));
const fs = require("fs");

const file = path.join(__dirname, "..", "End_To_End_Globalsqa1 (1).xlsm");
const sheet = "Test Set";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(2);
}

async function run() {
  if (!fs.existsSync(file)) fail("fresh workbook not found: " + file);

  const meta = svc.getWorkbookMeta(file);
  if (!meta || !Array.isArray(meta.sheets))
    fail("getWorkbookMeta failed or invalid");

  const sheetMeta = meta.sheets.find((s) => s.name === sheet);
  if (!sheetMeta) fail("sheet not found in meta: " + sheet);
  if (!sheetMeta.columns || sheetMeta.columns.length < 2)
    fail("unexpected headers: " + JSON.stringify(sheetMeta.columns));

  const read = svc.readSheet(file, sheet, { page: 1, pageSize: 5 });
  if (!read || !Array.isArray(read.rows)) fail("readSheet returned invalid");
  if (read.total < 1) fail("expected at least one row in fresh sheet");

  // copy and createRow
  const tmp = path.join(__dirname, "..", `tmp-reg-${Date.now()}.xlsm`);
  fs.copyFileSync(file, tmp);
  try {
    const res = await svc.createRow(
      tmp,
      sheet,
      { "Test Set ID": "reg-1", "Test Set Name": "reg-run", status: "Active" },
      { insertIndex: 0 }
    );
    if (!res || !res.success)
      fail("createRow failed on tmp copy: " + JSON.stringify(res));

    const read2 = svc.readSheet(tmp, sheet, { page: 1, pageSize: 5 });
    if (!read2 || read2.total < 1) fail("read after create returned no rows");

    console.log("regression passed");
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (e) {}
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
