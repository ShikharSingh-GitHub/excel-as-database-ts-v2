const path = require("path");
const svc = require(path.join(
  __dirname,
  "..",
  "src",
  "electron",
  "excelService.js"
));

const file = "/Users/shikhar/Desktop/workbook/Sample.xlsm";
const sheet = "Test Set";

async function run() {
  console.log("getWorkbookMeta before:");
  try {
    console.log(JSON.stringify(svc.getWorkbookMeta(file), null, 2));
  } catch (e) {
    console.error("meta before error", e);
  }

  console.log("\nreadSheet before:");
  try {
    console.log(
      JSON.stringify(
        svc.readSheet(file, sheet, { page: 1, pageSize: 5 }),
        null,
        2
      )
    );
  } catch (e) {
    console.error("read before error", e);
  }

  console.log(
    "Creating a test row (this will modify the workbook) - insert at top of data region..."
  );
  try {
    const res = await svc.createRow(
      file,
      sheet,
      {
        "Test Set ID": "99999",
        "Test Set Name": "tmp-insert",
        status: "Active",
      },
      { insertIndex: 0 }
    );
    console.log("createRow result:", res);
  } catch (e) {
    console.error("createRow error", e);
  }

  console.log("\ngetWorkbookMeta after:");
  try {
    console.log(JSON.stringify(svc.getWorkbookMeta(file), null, 2));
  } catch (e) {
    console.error("meta after error", e);
  }

  console.log("\nreadSheet after:");
  try {
    console.log(
      JSON.stringify(
        svc.readSheet(file, sheet, { page: 1, pageSize: 5 }),
        null,
        2
      )
    );
  } catch (e) {
    console.error("read after error", e);
  }
}

run().catch((e) => console.error(e));
