/**
 * Clean XLSM Service
 * ==================
 *
 * A much simpler approach to XLSM handling:
 * 1. Strip macros once (.xlsm -> .working.xlsx)
 * 2. Work with the clean XLSX file
 * 3. Use value-only patching to preserve styles
 * 4. Keep the .working.xlsx as the "source of truth"
 */

const fs = require("fs");
const path = require("path");
const macroStripper = require("./macroStripper");
const valuePatcher = require("./valuePatcher");
const originalExcelService = require("./excelService");

const log = (level, message, ctx) => {
  console.log(`[${level}] ${message}`, ctx ? JSON.stringify(ctx) : "");
};

class CleanXlsmService {
  constructor() {
    this.xlsmMappings = new Map(); // xlsmPath -> workingXlsxPath
    this.notifiedFiles = new Set(); // Track which files we've shown macro notification for
  }

  /**
   * Check if a file is an XLSM file
   */
  isXlsmFile(filePath) {
    return filePath.toLowerCase().endsWith(".xlsm");
  }

  /**
   * Get or create working XLSX file for an XLSM
   */
  async ensureWorkingXlsx(xlsmPath) {
    try {
      // Check if we already have a mapping
      if (this.xlsmMappings.has(xlsmPath)) {
        const workingPath = this.xlsmMappings.get(xlsmPath);
        if (fs.existsSync(workingPath)) {
          return workingPath;
        }
      }

      // Create working copy
      const workingPath = await macroStripper.ensureWorkingCopy(xlsmPath);
      this.xlsmMappings.set(xlsmPath, workingPath);

      // Mark for notification (first time seeing this XLSM)
      if (!this.notifiedFiles.has(xlsmPath)) {
        this.notifiedFiles.add(xlsmPath);
        log("INFO", "XLSM file detected - macros will be stripped", {
          xlsmPath,
        });
      }

      return workingPath;
    } catch (error) {
      log("ERROR", "Failed to ensure working XLSX", {
        xlsmPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Scan folder and handle XLSM files
   */
  async scanFolder(folderPath) {
    try {
      log("INFO", "Scanning folder with clean XLSM handling", { folderPath });

      // Get all files from original service
      const result = await originalExcelService.scanFolder(folderPath);
      const files = Array.isArray(result) ? result : result.files || [];

      const processedFiles = [];

      for (const file of files) {
        if (this.isXlsmFile(file.path)) {
          try {
            // Create working copy
            const workingPath = await this.ensureWorkingXlsx(file.path);

            // Add the working file to the list (but keep original name for UI)
            processedFiles.push({
              ...file,
              workingPath: workingPath,
              isXlsm: true,
              macro: true, // UI expects this property for XLSM badge
              originalPath: file.path,
              displayName: path.basename(file.path), // Show original XLSM name
            });
          } catch (error) {
            log("ERROR", "Failed to process XLSM file", {
              filePath: file.path,
              error: error.message,
            });
            // Add the file anyway, but mark as error
            processedFiles.push({
              ...file,
              isXlsm: true,
              macro: true, // UI expects this property for XLSM badge
              error: error.message,
            });
          }
        } else {
          // Regular XLSX/XLS file
          processedFiles.push(file);
        }
      }

      log("INFO", "Folder scan completed with clean XLSM handling", {
        folderPath,
        totalFiles: files.length,
        xlsmFiles: processedFiles.filter((f) => f.isXlsm).length,
        processedFiles: processedFiles.length,
      });

      return Array.isArray(result)
        ? processedFiles
        : { ...result, files: processedFiles };
    } catch (error) {
      log("ERROR", "Folder scan failed", { folderPath, error: error.message });
      throw error;
    }
  }

  /**
   * Get workbook metadata (works on the working XLSX)
   */
  async getWorkbookMeta(filePath, opts = {}) {
    try {
      const workingPath = this.isXlsmFile(filePath)
        ? await this.ensureWorkingXlsx(filePath)
        : filePath;

      const meta = await originalExcelService.getWorkbookMeta(
        workingPath,
        opts
      );

      // Add XLSM-specific metadata
      if (this.isXlsmFile(filePath)) {
        meta.isXlsm = true;
        meta.originalPath = filePath;
        meta.workingPath = workingPath;
        meta.macrosStripped = true;
      }

      return meta;
    } catch (error) {
      log("ERROR", "Failed to get workbook meta", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Read sheet data (from working XLSX) with empty row filtering
   */
  async readSheet(filePath, sheetName, options = {}) {
    try {
      const workingPath = this.isXlsmFile(filePath)
        ? await this.ensureWorkingXlsx(filePath)
        : filePath;

      const result = await originalExcelService.readSheet(
        workingPath,
        sheetName,
        options
      );

      // Filter out completely empty rows (rows where all cells are empty/null)
      if (result && result.rows) {
        const filteredRows = result.rows.filter((row) => {
          // Check if any cell in the row has a non-empty value
          return Object.values(row).some(
            (value) =>
              value !== null &&
              value !== undefined &&
              value !== "" &&
              String(value).trim() !== ""
          );
        });

        // Update the result with filtered rows
        result.rows = filteredRows;
        result.total = filteredRows.length;
      }

      return result;
    } catch (error) {
      log("ERROR", "Failed to read sheet", {
        filePath,
        sheetName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create row (using value patching for better formatting preservation)
   */
  async createRow(filePath, sheetName, rowData, opts = {}) {
    try {
      const workingPath = this.isXlsmFile(filePath)
        ? await this.ensureWorkingXlsx(filePath)
        : filePath;

      // Try to use valuePatcher first for better formatting preservation
      try {
        // Get current sheet data to find the next row
        const sheetData = await originalExcelService.readSheet(
          workingPath,
          sheetName,
          { page: 1, pageSize: 1000 }
        );

        if (sheetData && sheetData.rows) {
          // Get header row position from config or use default
          const headerRowPosition =
            this.getHeaderRowPosition(filePath, sheetName) || 4; // 0-based, so row 5 in Excel
          const dataStartRow = headerRowPosition + 1; // First data row after header

          // Find the next available row by scanning for the first empty row after data
          let nextRowNumber = dataStartRow + sheetData.rows.length + 1; // Default calculation

          // Check if there are any empty rows we can reuse
          const ExcelJS = require("exceljs");
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.readFile(workingPath);
          const worksheet = workbook.getWorksheet(sheetName);

          if (worksheet) {
            // Start from the first data row and find the first completely empty row
            for (
              let rowNum = dataStartRow + 1;
              rowNum <= dataStartRow + 100;
              rowNum++
            ) {
              let isEmpty = true;
              for (
                let colNum = 1;
                colNum <= sheetData.headers.length;
                colNum++
              ) {
                const cell = worksheet.getCell(rowNum, colNum);
                if (
                  cell.value !== null &&
                  cell.value !== undefined &&
                  cell.value !== ""
                ) {
                  isEmpty = false;
                  break;
                }
              }
              if (isEmpty) {
                nextRowNumber = rowNum;
                break;
              }
            }
          }

          log("DEBUG", "Create row calculation", {
            headerRowPosition,
            dataStartRow,
            rowsCount: sheetData.rows.length,
            nextRowNumber,
          });

          // Create patches for the new row
          const patches = [];
          Object.keys(rowData).forEach((header) => {
            if (rowData[header] !== undefined) {
              const colIndex = sheetData.headers.indexOf(header);
              if (colIndex !== -1) {
                const cellAddress = valuePatcher.getCellAddress(
                  nextRowNumber,
                  colIndex + 1
                );
                patches.push(
                  valuePatcher.createPatch(cellAddress, rowData[header])
                );
              }
            }
          });

          if (patches.length > 0) {
            const patchResult = await valuePatcher.patchValuesOnly(
              workingPath,
              sheetName,
              patches
            );

            if (patchResult.success) {
              log("INFO", "Row created using valuePatcher", {
                originalPath: filePath,
                workingPath,
                sheetName,
                patchesApplied: patchResult.patchedCells,
                isXlsm: this.isXlsmFile(filePath),
              });

              // Invalidate cache to force refresh
              await this.invalidateCache(filePath, sheetName);

              return {
                success: true,
                created: true,
                rowId: rowData.id || rowData._id,
                method: "valuePatcher",
              };
            }
          }
        }
      } catch (patchError) {
        log("WARN", "ValuePatcher failed, falling back to original service", {
          filePath,
          sheetName,
          error: patchError.message,
        });
      }

      // Fallback to original service
      const result = await originalExcelService.createRow(
        workingPath,
        sheetName,
        rowData,
        opts
      );

      log("INFO", "Row created using original service", {
        originalPath: filePath,
        workingPath,
        sheetName,
        isXlsm: this.isXlsmFile(filePath),
      });

      return result;
    } catch (error) {
      log("ERROR", "Failed to create row", {
        filePath,
        sheetName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update row (using value patching for better formatting preservation)
   */
  async updateRow(
    filePath,
    sheetName,
    rowId,
    updates,
    expectedVersion,
    opts = {}
  ) {
    try {
      const workingPath = this.isXlsmFile(filePath)
        ? await this.ensureWorkingXlsx(filePath)
        : filePath;

      // Try to use valuePatcher first for better formatting preservation
      try {
        // Get current sheet data to find the row
        const sheetData = await originalExcelService.readSheet(
          workingPath,
          sheetName,
          { page: 1, pageSize: 1000 }
        );

        if (sheetData && sheetData.rows) {
          // Find the row to update by row number (1-based)
          const rowNumber = parseInt(rowId, 10);
          if (
            isNaN(rowNumber) ||
            rowNumber < 1 ||
            rowNumber > sheetData.rows.length
          ) {
            log("WARN", "Invalid row number for update", {
              filePath,
              sheetName,
              rowId,
              rowNumber,
              totalRows: sheetData.rows.length,
            });
            return;
          }

          // Convert 1-based row number to 0-based index
          const rowIndex = rowNumber - 1;

          if (rowIndex !== -1) {
            // Get header row position from config or use default
            const headerRowPosition =
              this.getHeaderRowPosition(filePath, sheetName) || 4; // 0-based, so row 5 in Excel
            const dataStartRow = headerRowPosition + 1; // First data row after header
            const actualRowNumber = dataStartRow + rowIndex + 1; // +1 for 1-based Excel rows

            log("DEBUG", "Row calculation", {
              rowIndex,
              headerRowPosition,
              dataStartRow,
              actualRowNumber,
              rowId,
            });

            // Create patches for the updates
            const patches = [];
            Object.keys(updates).forEach((header) => {
              if (updates[header] !== undefined) {
                const colIndex = sheetData.headers.indexOf(header);
                if (colIndex !== -1) {
                  const cellAddress = valuePatcher.getCellAddress(
                    actualRowNumber,
                    colIndex + 1
                  );
                  patches.push(
                    valuePatcher.createPatch(cellAddress, updates[header])
                  );
                }
              }
            });

            if (patches.length > 0) {
              log("DEBUG", "Applying patches", {
                patches: patches.map((p) => ({ addr: p.addr, value: p.value })),
              });

              const patchResult = await valuePatcher.patchValuesOnly(
                workingPath,
                sheetName,
                patches
              );

              if (patchResult.success) {
                log("INFO", "Row updated using valuePatcher", {
                  originalPath: filePath,
                  workingPath,
                  sheetName,
                  rowId,
                  patchesApplied: patchResult.patchedCells,
                  isXlsm: this.isXlsmFile(filePath),
                });

                // Invalidate cache to force refresh
                await this.invalidateCache(filePath, sheetName);

                return {
                  success: true,
                  updated: true,
                  rowId: rowId,
                  method: "valuePatcher",
                };
              }
            }
          }
        }
      } catch (patchError) {
        log("WARN", "ValuePatcher failed, falling back to original service", {
          filePath,
          sheetName,
          rowId,
          error: patchError.message,
          stack: patchError.stack,
        });
      }

      // Fallback to original service
      const result = await originalExcelService.updateRow(
        workingPath,
        sheetName,
        rowId,
        updates,
        expectedVersion,
        opts
      );

      log("INFO", "Row updated using original service", {
        originalPath: filePath,
        workingPath,
        sheetName,
        rowId,
        isXlsm: this.isXlsmFile(filePath),
      });

      return result;
    } catch (error) {
      log("ERROR", "Failed to update row", {
        filePath,
        sheetName,
        rowId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete row (using value patching for better formatting preservation)
   */
  async deleteRow(filePath, sheetName, rowId, expectedVersion, opts = {}) {
    try {
      const workingPath = this.isXlsmFile(filePath)
        ? await this.ensureWorkingXlsx(filePath)
        : filePath;

      // Try to use valuePatcher first for better formatting preservation
      try {
        // Get current sheet data to find the row
        const sheetData = await originalExcelService.readSheet(
          workingPath,
          sheetName,
          { page: 1, pageSize: 1000 }
        );

        if (sheetData && sheetData.rows) {
          // Find the row to delete by row number (1-based)
          const rowNumber = parseInt(rowId, 10);
          if (
            isNaN(rowNumber) ||
            rowNumber < 1 ||
            rowNumber > sheetData.rows.length
          ) {
            log("WARN", "Invalid row number for delete", {
              filePath,
              sheetName,
              rowId,
              rowNumber,
              totalRows: sheetData.rows.length,
            });
            return;
          }

          // Convert 1-based row number to 0-based index
          const rowIndex = rowNumber - 1;

          if (rowIndex !== -1) {
            // Get header row position from config or use default
            const headerRowPosition =
              this.getHeaderRowPosition(filePath, sheetName) || 4; // 0-based, so row 5 in Excel
            const dataStartRow = headerRowPosition + 1; // First data row after header
            const actualRowNumber = dataStartRow + rowIndex + 1; // +1 for 1-based Excel rows

            log("DEBUG", "Delete row calculation", {
              rowIndex,
              headerRowPosition,
              dataStartRow,
              actualRowNumber,
              rowId,
            });

            // Create patches to clear the row (set all cells to empty)
            const patches = [];
            sheetData.headers.forEach((header, colIndex) => {
              const cellAddress = valuePatcher.getCellAddress(
                actualRowNumber,
                colIndex + 1
              );
              patches.push(valuePatcher.createPatch(cellAddress, ""));
            });

            if (patches.length > 0) {
              log("DEBUG", "Applying delete patches", {
                patches: patches.map((p) => ({ addr: p.addr, value: p.value })),
              });

              const patchResult = await valuePatcher.patchValuesOnly(
                workingPath,
                sheetName,
                patches
              );

              if (patchResult.success) {
                log("INFO", "Row deleted using valuePatcher", {
                  originalPath: filePath,
                  workingPath,
                  sheetName,
                  rowId,
                  patchesApplied: patchResult.patchedCells,
                  isXlsm: this.isXlsmFile(filePath),
                });

                // Invalidate cache to force refresh
                await this.invalidateCache(filePath, sheetName);

                return {
                  success: true,
                  deleted: true,
                  rowId: rowId,
                  method: "valuePatcher",
                };
              }
            }
          } else {
            log("WARN", "Row not found for deletion", {
              filePath,
              sheetName,
              rowId,
              availableRows: sheetData.rows.map(
                (r) => r.id || r._id || r[Object.keys(r)[0]]
              ),
            });
          }
        }
      } catch (patchError) {
        log(
          "WARN",
          "ValuePatcher delete failed, falling back to original service",
          {
            filePath,
            sheetName,
            rowId,
            error: patchError.message,
            stack: patchError.stack,
          }
        );
      }

      // Fallback to original service
      const result = await originalExcelService.deleteRow(
        workingPath,
        sheetName,
        rowId,
        expectedVersion,
        opts
      );

      log("INFO", "Row deleted using original service", {
        originalPath: filePath,
        workingPath,
        sheetName,
        rowId,
        isXlsm: this.isXlsmFile(filePath),
      });

      return result;
    } catch (error) {
      log("ERROR", "Failed to delete row", {
        filePath,
        sheetName,
        rowId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get header row position for a sheet
   */
  getHeaderRowPosition(filePath, sheetName) {
    try {
      const config = JSON.parse(
        require("fs").readFileSync(
          require("path").join(__dirname, "..", "..", "config.json"),
          "utf8"
        )
      );

      const headerRowConfig = config.headerRowConfig || {};
      const baseName = require("path").basename(filePath);

      // Check both full path and basename
      return (
        headerRowConfig[filePath]?.[sheetName] ||
        headerRowConfig[baseName]?.[sheetName] ||
        4
      ); // Default to row 5 (0-based index 4)
    } catch (error) {
      log("WARN", "Failed to get header row position", {
        filePath,
        sheetName,
        error: error.message,
      });
      return 4; // Default fallback
    }
  }

  /**
   * Invalidate cache for a specific sheet
   */
  async invalidateCache(filePath, sheetName) {
    try {
      // Call the original service's cache invalidation if it exists
      if (originalExcelService.invalidateCache) {
        await originalExcelService.invalidateCache(filePath);
      }

      log("DEBUG", "Cache invalidated", { filePath, sheetName });
    } catch (error) {
      log("WARN", "Failed to invalidate cache", {
        filePath,
        sheetName,
        error: error.message,
      });
    }
  }

  /**
   * Save file - for XLSM files, this is a no-op since we work with the .working.xlsx
   * For regular files, we don't need to do anything since ExcelJS auto-saves
   */
  async saveFile(filePath, opts = {}) {
    try {
      if (this.isXlsmFile(filePath)) {
        const workingPath = this.xlsmMappings.get(filePath);
        if (workingPath) {
          log("INFO", "XLSM save requested - working file is already saved", {
            originalPath: filePath,
            workingPath,
          });
          return {
            success: true,
            message: "Working XLSX file is automatically saved",
            workingPath,
          };
        } else {
          return {
            success: false,
            error: "No working copy found for XLSM file",
          };
        }
      } else {
        // Regular XLSX files are auto-saved by ExcelJS during operations
        log("INFO", "XLSX file save requested - file is already saved", {
          filePath,
        });
        return {
          success: true,
          message: "File is automatically saved during operations",
        };
      }
    } catch (error) {
      log("ERROR", "Failed to save file", { filePath, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get files that need macro stripping notification
   */
  getNewXlsmFiles() {
    return Array.from(this.notifiedFiles);
  }

  /**
   * Clear notification flags
   */
  clearNotifications() {
    this.notifiedFiles.clear();
  }

  /**
   * Clean up working files
   */
  cleanup() {
    for (const [xlsmPath, workingPath] of this.xlsmMappings) {
      try {
        if (fs.existsSync(workingPath)) {
          fs.unlinkSync(workingPath);
          log("INFO", "Cleaned up working file", { xlsmPath, workingPath });
        }
      } catch (error) {
        log("WARN", "Failed to clean up working file", {
          xlsmPath,
          workingPath,
          error: error.message,
        });
      }
    }
    this.xlsmMappings.clear();
    this.notifiedFiles.clear();
  }
}

module.exports = new CleanXlsmService();
