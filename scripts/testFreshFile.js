const path = require("path");
const svc = require(path.join(
  __dirname,
  "..",
  "src",
  "electron",
  "excelService.js"
));

const file = path.join(__dirname, "..", "End_To_End_Globalsqa1 (1).xlsm");
const sheet = "Test Set";

async function run() {
  console.log("file:", file);
  try {
    console.log("\ngetWorkbookMeta:");
    console.log(JSON.stringify(svc.getWorkbookMeta(file), null, 2));
  } catch (e) {
    console.error("getWorkbookMeta error", e);
  }

  try {
    console.log("\nreadSheet:");
    console.log(
      JSON.stringify(
        svc.readSheet(file, sheet, { page: 1, pageSize: 5 }),
        null,
        2
      )
    );
  } catch (e) {
    console.error("readSheet error", e);
  }

  try {
    console.log("\nAttempting createRow (won't modify original file):");
    // Instead of modifying original, copy to tmp and operate there
    const fs = require("fs");
    const tmp = path.join(__dirname, "..", `tmp-fresh-${Date.now()}.xlsm`);
    fs.copyFileSync(file, tmp);
    console.log("copied to", tmp);
    const res = await svc.createRow(
      tmp,
      sheet,
      { "Test Set ID": "f999", "Test Set Name": "tmp-fresh", status: "Active" },
      { insertIndex: 0 }
    );
    console.log("createRow result:", res);
    console.log("\nreadSheet on tmp:");
    console.log(
      JSON.stringify(
        svc.readSheet(tmp, sheet, { page: 1, pageSize: 5 }),
        null,
        2
      )
    );
    // cleanup
    try {
      fs.unlinkSync(tmp);
      console.log("tmp removed");
    } catch (e) {}
  } catch (e) {
    console.error("createRow/test error", e);
  }
}

run().catch((e) => console.error(e));
