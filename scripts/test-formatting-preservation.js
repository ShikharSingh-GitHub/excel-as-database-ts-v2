#!/usr/bin/env node
/**
 * Test Formatting Preservation
 * ============================
 *
 * Tests that XLSM to XLSX conversion preserves formatting, styles, and formulas.
 *
 * Usage: node scripts/test-formatting-preservation.js <sample.xlsm>
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const ExcelJS = require("exceljs");
const macroStripper = require("../src/electron/macroStripper");

async function testFormattingPreservation(xlsmPath) {
  console.log("Testing formatting preservation for:", xlsmPath);

  if (!fs.existsSync(xlsmPath)) {
    console.error("File not found:", xlsmPath);
    process.exit(1);
  }

  // Create temporary directory for testing
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "format-test-"));
  const xlsxPath = path.join(
    tmpDir,
    path.basename(xlsmPath, ".xlsm") + ".xlsx"
  );

  try {
    console.log("1. Loading original XLSM file...");
    const originalWorkbook = new ExcelJS.Workbook();
    await originalWorkbook.xlsx.readFile(xlsmPath);

    console.log("2. Extracting formatting information from original...");
    const originalFormatting = extractFormattingInfo(originalWorkbook);

    console.log("3. Converting XLSM to XLSX using macro stripper...");
    const result = await macroStripper.ensureWorkingCopy(xlsmPath);
    console.log("   Working copy created at:", result);

    console.log("4. Loading converted XLSX file...");
    const convertedWorkbook = new ExcelJS.Workbook();
    await convertedWorkbook.xlsx.readFile(result);

    console.log("5. Extracting formatting information from converted file...");
    const convertedFormatting = extractFormattingInfo(convertedWorkbook);

    console.log("6. Comparing formatting...");
    const comparison = compareFormatting(
      originalFormatting,
      convertedFormatting
    );

    console.log("\n=== FORMATTING PRESERVATION TEST RESULTS ===");
    console.log("Original sheets:", originalFormatting.sheets.length);
    console.log("Converted sheets:", convertedFormatting.sheets.length);
    console.log("Formulas preserved:", comparison.formulasPreserved);
    console.log("Styles preserved:", comparison.stylesPreserved);
    console.log("Colors preserved:", comparison.colorsPreserved);
    console.log("Overall preservation score:", comparison.score + "%");

    if (comparison.score >= 90) {
      console.log("✅ Formatting preservation is working well!");
    } else if (comparison.score >= 70) {
      console.log("⚠️  Formatting preservation needs improvement");
    } else {
      console.log("❌ Significant formatting loss detected");
    }

    // Clean up
    if (fs.existsSync(result)) {
      fs.unlinkSync(result);
    }
    fs.rmdirSync(tmpDir);
  } catch (error) {
    console.error("Test failed:", error.message);
    process.exit(1);
  }
}

function extractFormattingInfo(workbook) {
  const info = {
    sheets: [],
    totalFormulas: 0,
    totalStyles: 0,
    totalColors: 0,
  };

  workbook.eachSheet((worksheet, sheetId) => {
    const sheetInfo = {
      name: worksheet.name,
      formulas: 0,
      styles: 0,
      colors: 0,
      cells: 0,
    };

    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        sheetInfo.cells++;

        // Count formulas
        if (cell.formula) {
          sheetInfo.formulas++;
          info.totalFormulas++;
        }

        // Count styled cells
        if (cell.style) {
          sheetInfo.styles++;
          info.totalStyles++;
        }

        // Count colored cells
        if (cell.fill && cell.fill.type === "pattern") {
          sheetInfo.colors++;
          info.totalColors++;
        }
      });
    });

    info.sheets.push(sheetInfo);
  });

  return info;
}

function compareFormatting(original, converted) {
  const comparison = {
    formulasPreserved: 0,
    stylesPreserved: 0,
    colorsPreserved: 0,
    score: 0,
  };

  // Simple comparison - in a real scenario you'd want more sophisticated matching
  const originalTotal =
    original.totalFormulas + original.totalStyles + original.totalColors;
  const convertedTotal =
    converted.totalFormulas + converted.totalStyles + converted.totalColors;

  if (originalTotal > 0) {
    comparison.score = Math.round((convertedTotal / originalTotal) * 100);
  }

  comparison.formulasPreserved = converted.totalFormulas;
  comparison.stylesPreserved = converted.totalStyles;
  comparison.colorsPreserved = converted.totalColors;

  return comparison;
}

// Main execution
if (require.main === module) {
  const xlsmPath = process.argv[2];

  if (!xlsmPath) {
    console.error(
      "Usage: node scripts/test-formatting-preservation.js <sample.xlsm>"
    );
    process.exit(1);
  }

  testFormattingPreservation(xlsmPath)
    .then(() => {
      console.log("Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

module.exports = { testFormattingPreservation };
