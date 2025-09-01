const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");
const XLSX = require("xlsx");
const svc = require("../src/electron/excelService");

// Usage: node scripts/regression-preserve-formulas.js <sample.xlsm>
(async () => {
  try {
    const sample = process.argv[2];
    if (!sample) {
      console.error(
        "Usage: node scripts/regression-preserve-formulas.js <sample.xlsm>"
      );
      process.exit(2);
    }

    if (!fs.existsSync(sample)) {
      console.error("Sample file not found:", sample);
      process.exit(2);
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "xlsm-test-"));
    const copyPath = path.join(tmpDir, path.basename(sample));
    fs.copyFileSync(sample, copyPath);
    console.log("Copied sample to", copyPath);

    const meta = svc.getWorkbookMeta(copyPath);
    if (!meta || !meta.sheets || meta.sheets.length === 0) {
      console.error("No sheets found in workbook metadata");
      process.exit(2);
    }
    let sheetName = meta.sheets[0];
    // meta.sheets entries may be objects with a `name` property
    if (typeof sheetName === "object" && sheetName !== null) {
      sheetName = sheetName.name || sheetName.sheetName || String(sheetName);
    }
    console.log("Using sheet:", sheetName);

    // Read initial workbook to find a formula cell to check
    const wbBefore = XLSX.readFile(copyPath, {
      bookVBA: true,
      cellStyles: true,
    });
    const wsBefore = wbBefore.Sheets[sheetName];

    // Find first formula cell in the sheet
    let formulaAddr = null;
    let formulaFoundInitially = false;
    if (wsBefore && wsBefore["!ref"]) {
      const range = XLSX.utils.decode_range(wsBefore["!ref"]);
      for (let r = range.s.r; r <= range.e.r && formulaAddr == null; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ c, r });
          const cell = wsBefore[addr];
          if (cell && cell.f) {
            formulaAddr = addr;
            formulaFoundInitially = true;
            break;
          }
        }
      }
    }

    if (!formulaAddr) {
      console.warn(
        "No formula cell found in sample; skipping formula-preservation check"
      );
      formulaAddr = null;
    }

    console.log("Probe formula cell:", formulaAddr);

    // Confirm VBA present by inspecting the zipped file entries
    const zipBuf = fs.readFileSync(copyPath);
    const zipStr = zipBuf.toString("binary");
    const hasVBA =
      zipStr.includes("xl/vbaProject.bin") || zipStr.includes("VBA");
    assert(hasVBA, "Initial workbook must contain VBA (vbaProject.bin)");
    console.log("VBA presence confirmed");

    // Create a temporary sheet with PK column so CRUD by PK is possible
    const pkName = (svc.readConfig && svc.readConfig().pkName) || "id";
    const tmpSheetName = "__reg_test";
    try {
      const wb = XLSX.readFile(copyPath, { bookVBA: true, cellStyles: true });
      // add a temporary sheet with headers [pkName, 'col1'] and one sample row
      const headers = [pkName, "col1"];
      const sampleRow = { [pkName]: require("uuid").v4(), col1: "initial" };
      const tmpWs = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
      wb.SheetNames.push(tmpSheetName);
      wb.Sheets[tmpSheetName] = tmpWs;
      // Safe write: for .xlsm write to a .data.xlsx sidecar instead of overwriting the presentation
      const ext = path.extname(copyPath).toLowerCase().replace(".", "");
      const sidecarPath = ext === "xlsm" ? `${copyPath}.data.xlsx` : copyPath;
      const writeArgs =
        ext === "xlsm"
          ? { bookType: "xlsx", cellStyles: true }
          : { bookVBA: true, cellStyles: true };
      XLSX.writeFile(wb, sidecarPath, writeArgs);
      console.log(
        "Added temporary sheet for CRUD tests:",
        tmpSheetName,
        "->",
        sidecarPath
      );
    } catch (e) {
      console.warn(
        "Failed to add temporary sheet; attempting to proceed:",
        e.message
      );
    }

    // Read current rows to capture existing PKs from the tmp sheet
    const beforeRead = await svc.readSheet(copyPath, tmpSheetName, {
      page: 1,
      pageSize: 1000,
    });
    const beforeRows =
      beforeRead && Array.isArray(beforeRead.rows) ? beforeRead.rows : [];
    const beforePkSet = new Set(
      beforeRows.map((r) => r && r[pkName]).filter(Boolean)
    );

    // Choose an existing header to write a sentinel value so the created row is discoverable
    let sentinelHeader = null;
    try {
      const meta2 = svc.getWorkbookMeta(copyPath);
      const sheetMeta =
        meta2 && meta2.sheets
          ? meta2.sheets.find((s) => (s.name || s) === sheetName)
          : null;
      const cols = sheetMeta && sheetMeta.columns ? sheetMeta.columns : null;
      if (Array.isArray(cols) && cols.length > 0) sentinelHeader = cols[0];
    } catch (e) {}
    if (!sentinelHeader) sentinelHeader = "test_col";

    const sentinelValue = "reg-created-" + Date.now();

    // Perform a create row (append) on the temporary sheet
    console.log("Creating a test row in temp sheet", tmpSheetName, "...");
    const createRes = await svc.createRow(
      copyPath,
      tmpSheetName,
      { [pkName]: require("uuid").v4(), col1: "created" },
      { usePresentationSheet: true }
    );
    console.log(
      "createRes:",
      JSON.stringify(
        createRes && createRes.row
          ? {
              pk: createRes.row[
                (svc.readConfig && svc.readConfig().pkName) || "id"
              ],
              _version: createRes.row && createRes.row._version,
            }
          : createRes
      )
    );
    assert(
      createRes && createRes.success,
      "createRow failed: " + JSON.stringify(createRes)
    );

    // Re-read tmp sheet to find rows and the created row's PK/version
    console.log("Re-reading temp sheet to locate rows...");
    let read = await svc.readSheet(copyPath, tmpSheetName, {
      page: 1,
      pageSize: 200,
    });
    if (!read || !Array.isArray(read.rows) || read.rows.length === 0) {
      // fallback to raw sheet json
      const raw = svc.readSheetJson(copyPath, sheetName);
      if (raw && Array.isArray(raw.json) && raw.json.length > 0) {
        read = { rows: raw.json };
      }
    }

    if (!read || !Array.isArray(read.rows) || read.rows.length === 0) {
      throw new Error(
        "No data rows available after create to perform update/delete"
      );
    }

    // Attempt to find the created row by detecting a PK not present before or by sentinel value
    const afterRows = read && Array.isArray(read.rows) ? read.rows : [];
    let createdRow = null;
    for (const r of afterRows) {
      const pk = r && r[pkName];
      if (pk && !beforePkSet.has(pk)) {
        createdRow = r;
        break;
      }
    }

    if (!createdRow) {
      console.warn(
        "Created row not found via PK diff; falling back to sentinel header match"
      );
      createdRow = afterRows.find(
        (r) => r && String(r[sentinelHeader]) === String(sentinelValue)
      );
    }

    // Pick a target row to update: prefer a row from beforeRows (existing data in tmp sheet), else any other.
    // If none available, fall back to the createdRow (safe since createRes gives us PK/_version)
    let targetRow = beforeRows.find((r) => r && r[pkName]);
    if (!targetRow)
      targetRow = afterRows.find(
        (r) =>
          r &&
          r[pkName] &&
          (!createdRow || String(r[pkName]) !== String(createdRow[pkName]))
      );
    if (!targetRow && createdRow) targetRow = createdRow;
    if (!targetRow && createRes && createRes.row) targetRow = createRes.row;
    if (!targetRow) targetRow = createdRow || afterRows[0];

    if (!targetRow || !targetRow[pkName]) {
      throw new Error("No suitable row found to update");
    }

    console.log("Updating row with PK:", targetRow[pkName]);
    const updateRes = await svc.updateRow(
      copyPath,
      tmpSheetName,
      targetRow[pkName],
      { col1: "updated" },
      targetRow["_version"],
      { usePresentationSheet: true }
    );
    assert(
      updateRes && updateRes.success,
      "updateRow failed: " + JSON.stringify(updateRes)
    );

    // Perform delete on the row we created earlier (must exist)
    if (!createdRow || !createdRow[pkName]) {
      throw new Error("Could not locate created row to delete");
    }
    console.log("Deleting the created row with PK:", createdRow[pkName]);
    const delRes = await svc.deleteRow(
      copyPath,
      tmpSheetName,
      createdRow[pkName],
      createdRow["_version"],
      { usePresentationSheet: true }
    );
    assert(
      delRes && delRes.success,
      "deleteRow failed: " + JSON.stringify(delRes)
    );

    // Re-open workbook and verify formula cell still has .f (only if a formula existed initially)
    if (formulaFoundInitially && formulaAddr) {
      const wbAfter = XLSX.readFile(copyPath, {
        bookVBA: true,
        cellStyles: true,
      });
      const wsAfter = wbAfter.Sheets[sheetName];
      const cellAfter = wsAfter[formulaAddr];
      assert(cellAfter && cellAfter.f, "Formula cell lost .f after edits");
      console.log("Formula cell preserved");
    } else {
      console.log(
        "No initial formula to verify; skipped formula-preservation check"
      );
    }

    // Verify VBA still exists in final file
    const zipBuf2 = fs.readFileSync(copyPath);
    const zipStr2 = zipBuf2.toString("binary");
    const hasVBA2 =
      zipStr2.includes("xl/vbaProject.bin") || zipStr2.includes("VBA");
    assert(hasVBA2, "VBA lost after edits");
    console.log("VBA preserved");

    // Cleanup: remove temporary sheet from sidecar if present, otherwise from presentation
    try {
      const ext2 = path.extname(copyPath).toLowerCase().replace(".", "");
      const sidecar2 = ext2 === "xlsm" ? `${copyPath}.data.xlsx` : copyPath;
      if (fs.existsSync(sidecar2)) {
        const wbCleanup = XLSX.readFile(sidecar2, {
          bookVBA: false,
          cellStyles: true,
        });
        if (wbCleanup.SheetNames.includes(tmpSheetName)) {
          delete wbCleanup.Sheets[tmpSheetName];
          wbCleanup.SheetNames = wbCleanup.SheetNames.filter(
            (n) => n !== tmpSheetName
          );
          XLSX.writeFile(wbCleanup, sidecar2, {
            bookType: "xlsx",
            cellStyles: true,
          });
          console.log("Cleaned up temporary sheet from sidecar", sidecar2);
        }
      } else {
        // fallback: attempt to remove from presentation (less desirable)
        try {
          // Avoid overwriting the original .xlsm; write cleanup to sidecar instead
          const wbCleanup2 = XLSX.readFile(copyPath, {
            bookVBA: true,
            cellStyles: true,
          });
          if (wbCleanup2.SheetNames.includes(tmpSheetName)) {
            delete wbCleanup2.Sheets[tmpSheetName];
            wbCleanup2.SheetNames = wbCleanup2.SheetNames.filter(
              (n) => n !== tmpSheetName
            );
            const sidecarCleanup = `${copyPath}.data.xlsx`;
            XLSX.writeFile(wbCleanup2, sidecarCleanup, {
              bookType: "xlsx",
              cellStyles: true,
            });
            console.log(
              "Cleaned up temporary sheet by writing sidecar",
              sidecarCleanup
            );
          }
        } catch (e) {
          // ignore cleanup errors
        }
      }
    } catch (e) {
      // ignore cleanup errors
    }

    console.log("Regression test passed");
    process.exit(0);
  } catch (err) {
    console.error(
      "Regression test failed:",
      err && err.message ? err.message : err
    );
    process.exit(1);
  }
})();
