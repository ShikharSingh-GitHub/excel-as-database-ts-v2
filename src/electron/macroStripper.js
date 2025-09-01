/**
 * Macro Stripper Service
 * ======================
 *
 * Provides clean XLSM -> XLSX conversion by stripping VBA macros
 * while preserving all formulas, formatting, and styles.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const log = (level, message, ctx) => {
  console.log(`[${level}] ${message}`, ctx ? JSON.stringify(ctx) : "");
};

class MacroStripper {
  constructor() {
    this.scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "scripts",
      "xlsm_to_xlsx_strip.py"
    );
  }

  /**
   * Strip macros using ExcelJS (better formatting preservation)
   *
   * @param {string} xlsmPath - Path to input .xlsm file
   * @param {string} xlsxPath - Path to output .xlsx file
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async stripXlsmToXlsxWithExcelJS(xlsmPath, xlsxPath) {
    try {
      log("INFO", "Starting ExcelJS macro stripping", { xlsmPath, xlsxPath });

      // Validate input file exists
      if (!fs.existsSync(xlsmPath)) {
        throw new Error(`Input XLSM file not found: ${xlsmPath}`);
      }

      // Create output directory if needed
      const xlsxDir = path.dirname(xlsxPath);
      if (!fs.existsSync(xlsxDir)) {
        fs.mkdirSync(xlsxDir, { recursive: true });
      }

      // Load the XLSM workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(xlsmPath);

      // Remove VBA project if it exists
      if (workbook.vbaProject) {
        log("INFO", "Removing VBA project", { xlsmPath });
        workbook.vbaProject = null;
      }

      // Save as XLSX with enhanced formatting preservation
      await workbook.xlsx.writeFile(xlsxPath, {
        filename: xlsxPath,
        useStyles: true,
        useSharedStrings: true,
      });

      // Verify output file was created
      if (!fs.existsSync(xlsxPath)) {
        throw new Error("Output XLSX file was not created");
      }

      const inputSize = fs.statSync(xlsmPath).size;
      const outputSize = fs.statSync(xlsxPath).size;

      log("INFO", "ExcelJS macro stripping completed successfully", {
        xlsmPath,
        xlsxPath,
        inputSize,
        outputSize,
        reduction: `${(((inputSize - outputSize) / inputSize) * 100).toFixed(
          1
        )}%`,
      });

      return {
        success: true,
        inputSize,
        outputSize,
        method: "exceljs",
      };
    } catch (error) {
      log("ERROR", "ExcelJS macro stripping failed", {
        xlsmPath,
        xlsxPath,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
        method: "exceljs",
      };
    }
  }

  /**
   * Strip macros from XLSM file, creating clean XLSX working copy
   *
   * @param {string} xlsmPath - Path to input .xlsm file
   * @param {string} xlsxPath - Path to output .xlsx file
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async stripXlsmToXlsx(xlsmPath, xlsxPath) {
    try {
      log("INFO", "Starting macro stripping", { xlsmPath, xlsxPath });

      // Validate input file exists
      if (!fs.existsSync(xlsmPath)) {
        throw new Error(`Input XLSM file not found: ${xlsmPath}`);
      }

      // Validate script exists
      if (!fs.existsSync(this.scriptPath)) {
        throw new Error(`Macro stripper script not found: ${this.scriptPath}`);
      }

      // Create output directory if needed
      const xlsxDir = path.dirname(xlsxPath);
      if (!fs.existsSync(xlsxDir)) {
        fs.mkdirSync(xlsxDir, { recursive: true });
      }

      // Execute the Python script
      const result = spawnSync(
        "python3",
        [this.scriptPath, xlsmPath, xlsxPath],
        {
          encoding: "utf8",
          timeout: 30000, // 30 second timeout
        }
      );

      if (result.status !== 0) {
        const errorMsg = result.stderr || result.stdout || "Macro strip failed";
        throw new Error(errorMsg);
      }

      // Verify output file was created
      if (!fs.existsSync(xlsxPath)) {
        throw new Error("Output XLSX file was not created");
      }

      const inputSize = fs.statSync(xlsmPath).size;
      const outputSize = fs.statSync(xlsxPath).size;

      log("INFO", "Macro stripping completed successfully", {
        xlsmPath,
        xlsxPath,
        inputSize,
        outputSize,
        reduction: `${(((inputSize - outputSize) / inputSize) * 100).toFixed(
          1
        )}%`,
      });

      return {
        success: true,
        inputSize,
        outputSize,
        method: "python",
      };
    } catch (error) {
      log("ERROR", "Macro stripping failed", {
        xlsmPath,
        xlsxPath,
        error: error.message,
      });
      return {
        success: false,
        error: error.message,
        method: "python",
      };
    }
  }

  /**
   * Generate working XLSX path for an XLSM file
   *
   * @param {string} xlsmPath - Original XLSM file path
   * @returns {string} Working XLSX file path
   */
  getWorkingXlsxPath(xlsmPath) {
    const dir = path.dirname(xlsmPath);
    const name = path.basename(xlsmPath, ".xlsm");
    return path.join(dir, `${name}.working.xlsx`);
  }

  /**
   * Check if working XLSX exists and is newer than XLSM
   *
   * @param {string} xlsmPath - Original XLSM file path
   * @returns {boolean} True if working copy is up to date
   */
  isWorkingCopyUpToDate(xlsmPath) {
    try {
      const xlsxPath = this.getWorkingXlsxPath(xlsmPath);

      if (!fs.existsSync(xlsxPath)) {
        return false;
      }

      const xlsmStat = fs.statSync(xlsmPath);
      const xlsxStat = fs.statSync(xlsxPath);

      // Working copy should be newer than or same age as original
      return xlsxStat.mtime >= xlsmStat.mtime;
    } catch (error) {
      log("WARN", "Failed to check working copy status", {
        xlsmPath,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Ensure working XLSX copy exists and is up to date
   *
   * @param {string} xlsmPath - Original XLSM file path
   * @returns {Promise<string>} Path to working XLSX file
   */
  async ensureWorkingCopy(xlsmPath) {
    const xlsxPath = this.getWorkingXlsxPath(xlsmPath);

    if (this.isWorkingCopyUpToDate(xlsmPath)) {
      log("INFO", "Working copy is up to date", { xlsmPath, xlsxPath });
      return xlsxPath;
    }

    log("INFO", "Creating/updating working copy", { xlsmPath, xlsxPath });

    // Try ExcelJS first for better formatting preservation
    let result = await this.stripXlsmToXlsxWithExcelJS(xlsmPath, xlsxPath);

    // Fallback to Python script if ExcelJS fails
    if (!result.success) {
      log(
        "WARN",
        "ExcelJS macro stripping failed, falling back to Python script",
        {
          xlsmPath,
          error: result.error,
        }
      );
      result = await this.stripXlsmToXlsx(xlsmPath, xlsxPath);
    }

    if (!result.success) {
      throw new Error(`Failed to create working copy: ${result.error}`);
    }

    log("INFO", "Working copy created successfully", {
      xlsmPath,
      xlsxPath,
      method: result.method,
    });

    return xlsxPath;
  }

  /**
   * Clean up working XLSX files
   *
   * @param {string} xlsmPath - Original XLSM file path
   */
  cleanupWorkingCopy(xlsmPath) {
    try {
      const xlsxPath = this.getWorkingXlsxPath(xlsmPath);
      if (fs.existsSync(xlsxPath)) {
        fs.unlinkSync(xlsxPath);
        log("INFO", "Working copy cleaned up", { xlsxPath });
      }
    } catch (error) {
      log("WARN", "Failed to clean up working copy", {
        xlsmPath,
        error: error.message,
      });
    }
  }
}

module.exports = new MacroStripper();
