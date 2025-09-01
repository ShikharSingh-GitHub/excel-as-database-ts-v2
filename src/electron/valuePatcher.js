/**
 * Value Patcher Service
 * =====================
 *
 * Patches only cell values in XLSX files while preserving all formatting,
 * styles, column widths, formulas, and other structural elements.
 */

const ExcelJS = require("exceljs");
const fs = require("fs");

const log = (level, message, ctx) => {
  console.log(`[${level}] ${message}`, ctx ? JSON.stringify(ctx) : "");
};

class ValuePatcher {
  /**
   * Patch cell values in XLSX file without touching styles or structure
   *
   * @param {string} filePath - Path to XLSX file
   * @param {string} sheetName - Name of the sheet to patch
   * @param {Array<{addr: string, value: any}>} patches - Array of cell patches
   * @returns {Promise<{success: boolean, patchedCells: number, error?: string}>}
   */
  async patchValuesOnly(filePath, sheetName, patches) {
    try {
      log("INFO", "Starting value patching", {
        filePath,
        sheetName,
        patchCount: patches.length,
      });

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Load workbook
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // Get worksheet
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found in workbook`);
      }

      let patchedCells = 0;

      // Apply patches - only change values, preserve everything else
      for (const patch of patches) {
        try {
          const cell = worksheet.getCell(patch.addr);

          // Store original formula/style info for logging
          const originalValue = cell.value;
          const hasFormula = cell.type === ExcelJS.ValueType.Formula;

          // Only patch if it's not a formula (unless explicitly requested)
          if (hasFormula && !patch.replaceFormula) {
            log("WARN", "Skipping formula cell", {
              addr: patch.addr,
              formula: cell.formula,
            });
            continue;
          }

          // Set only the value - ExcelJS preserves styles automatically
          cell.value = patch.value;
          patchedCells++;

          log("DEBUG", "Patched cell", {
            addr: patch.addr,
            oldValue: originalValue,
            newValue: patch.value,
            wasFormula: hasFormula,
          });
        } catch (cellError) {
          log("ERROR", "Failed to patch cell", {
            addr: patch.addr,
            value: patch.value,
            error: cellError.message,
          });
        }
      }

      // Save the workbook with enhanced formatting preservation
      await workbook.xlsx.writeFile(filePath, {
        filename: filePath,
        useStyles: true,
        useSharedStrings: true,
      });

      log("INFO", "Value patching completed", {
        filePath,
        sheetName,
        totalPatches: patches.length,
        patchedCells,
        skipped: patches.length - patchedCells,
      });

      return {
        success: true,
        patchedCells,
        totalPatches: patches.length,
      };
    } catch (error) {
      log("ERROR", "Value patching failed", {
        filePath,
        sheetName,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a single cell patch object
   *
   * @param {string} address - Cell address (e.g., 'A1', 'B2')
   * @param {any} value - New cell value
   * @param {boolean} replaceFormula - Whether to replace formulas (default: false)
   * @returns {Object} Patch object
   */
  createPatch(address, value, replaceFormula = false) {
    return {
      addr: address,
      value: value,
      replaceFormula: replaceFormula,
    };
  }

  /**
   * Create patches from a data row for updating a specific row
   *
   * @param {number} rowIndex - 1-based row index
   * @param {Object} rowData - Object with column names as keys
   * @param {Array<string>} columnHeaders - Array of column header names
   * @returns {Array} Array of patch objects
   */
  createRowPatches(rowIndex, rowData, columnHeaders) {
    const patches = [];

    columnHeaders.forEach((header, colIndex) => {
      if (rowData.hasOwnProperty(header) && rowData[header] !== undefined) {
        const cellAddress = this.getCellAddress(rowIndex, colIndex + 1); // +1 for 1-based columns
        patches.push(this.createPatch(cellAddress, rowData[header]));
      }
    });

    return patches;
  }

  /**
   * Convert row/column indices to Excel cell address
   *
   * @param {number} row - 1-based row index
   * @param {number} col - 1-based column index
   * @returns {string} Excel cell address (e.g., 'A1', 'B2')
   */
  getCellAddress(row, col) {
    let columnName = "";
    while (col > 0) {
      col--;
      columnName = String.fromCharCode(65 + (col % 26)) + columnName;
      col = Math.floor(col / 26);
    }
    return columnName + row;
  }

  /**
   * Batch patch multiple rows efficiently
   *
   * @param {string} filePath - Path to XLSX file
   * @param {string} sheetName - Name of the sheet to patch
   * @param {Array} updates - Array of {rowIndex, rowData} objects
   * @param {Array<string>} columnHeaders - Array of column header names
   * @returns {Promise<{success: boolean, totalPatches: number, error?: string}>}
   */
  async batchPatchRows(filePath, sheetName, updates, columnHeaders) {
    try {
      const allPatches = [];

      // Generate patches for all row updates
      updates.forEach((update) => {
        const rowPatches = this.createRowPatches(
          update.rowIndex,
          update.rowData,
          columnHeaders
        );
        allPatches.push(...rowPatches);
      });

      // Apply all patches in one operation
      const result = await this.patchValuesOnly(
        filePath,
        sheetName,
        allPatches
      );

      return {
        success: result.success,
        totalPatches: result.patchedCells,
        rowsUpdated: updates.length,
        error: result.error,
      };
    } catch (error) {
      log("ERROR", "Batch patch failed", {
        filePath,
        sheetName,
        updateCount: updates.length,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new ValuePatcher();
