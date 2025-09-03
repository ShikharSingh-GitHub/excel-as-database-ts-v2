const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const excelService = require("./excelService");
const collectionStore = require("./collectionStore");
const normalizationService = require("./normalizationService");

// Use the same logging function as excelService
const log = (level, message, ctx) => {
  try {
    const ts = new Date().toISOString();
    const line =
      `${ts} [${level}] ${message}` + (ctx ? ` ${JSON.stringify(ctx)}` : "");
    console.log(line);
  } catch (e) {
    console.error("Log error:", e);
  }
};

// Use built-in fetch if available (Node 18+), otherwise use node-fetch
let fetch;
try {
  // Try to use built-in fetch first
  fetch = globalThis.fetch;
  if (!fetch) {
    // Fallback to node-fetch
    fetch = require("node-fetch");
  }
} catch (error) {
  // If node-fetch is not available, we'll handle it in the function
  fetch = null;
}

class JsonService {
  constructor() {
    this.cache = new Map();
    this.apiCache = new Map();
    this.profiles = new Map(); // Cache for dataset profiles
    this.maxDepth = 6; // Maximum nesting depth
    this.maxVisibleColumns = 50; // Maximum visible columns
    this.sampleSize = 200; // Number of rows to sample for schema inference
  }

  /**
   * Fetch JSON data from API and save locally
   */
  async fetchAndSaveJson(
    apiUrl,
    fileName,
    displayName,
    method = "GET",
    payload = null,
    headers = {}
  ) {
    try {
      log("INFO", "Fetching JSON from API", {
        apiUrl,
        fileName,
        displayName,
        method,
        payload,
      });

      // Check if fetch is available
      if (!fetch) {
        throw new Error(
          "Fetch API not available. Please install node-fetch or use Node.js 18+"
        );
      }

      // Prepare fetch options
      const fetchOptions = {
        method: method,
        headers: {
          "Content-Type": "application/json",
          ...headers, // Merge custom headers
        },
      };

      // Add payload for POST requests
      if (method === "POST" && payload) {
        fetchOptions.body = JSON.stringify(payload);
      }

      // Fetch from API
      const response = await fetch(apiUrl, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonData = await response.json();

      // For POST requests, the response might be a single object, so wrap it in an array
      let processedData = jsonData;
      if (method === "POST" && !Array.isArray(jsonData)) {
        processedData = [jsonData];
      }

      // Handle complex nested structures by flattening them
      if (!Array.isArray(processedData)) {
        // If it's a single object with nested arrays, try to extract the main data
        if (typeof processedData === "object" && processedData !== null) {
          // Look for common patterns in the response
          if (processedData.data && Array.isArray(processedData.data)) {
            processedData = processedData.data;
          } else if (
            processedData.data &&
            typeof processedData.data === "object"
          ) {
            // If data is an object, wrap the entire response in an array
            processedData = [processedData];
          } else {
            // Wrap single object in array
            processedData = [processedData];
          }
        } else {
          throw new Error("API must return a JSON array or object");
        }
      }

      // Generate file path in the current folder
      const config = excelService.readConfig();
      const folderPath = config.folderPath;

      if (!folderPath) {
        throw new Error("No folder path configured");
      }

      // Ensure fileName has .json extension
      if (!fileName.endsWith(".json")) {
        fileName += ".json";
      }

      const filePath = path.join(folderPath, fileName);

      // Save to local file
      await fs.writeFile(filePath, JSON.stringify(processedData, null, 2));

      log("INFO", "JSON file saved successfully", {
        filePath,
        fileName,
        displayName,
        rowCount: processedData.length,
        method,
        hasPayload: !!payload,
      });

      return {
        success: true,
        filePath,
        fileName,
        displayName,
        rowCount: processedData.length,
        method,
        hasPayload: !!payload,
      };
    } catch (error) {
      log("ERROR", "Failed to fetch and save JSON", {
        apiUrl,
        fileName,
        error: error.message,
      });
      throw new Error(`Failed to fetch JSON: ${error.message}`);
    }
  }

  /**
   * Read JSON file and convert to table format using schema inference
   */
  async readJsonFile(filePath, opts = {}) {
    try {
      log("DEBUG", "Reading JSON file with schema inference", {
        filePath,
        opts,
      });

      const content = await fs.readFile(filePath, "utf8");
      const jsonData = JSON.parse(content);

      // Clear profile cache if forceRefresh is requested
      if (opts.forceRefresh) {
        this.profiles.delete(filePath);
        log("DEBUG", "Profile cache cleared due to forceRefresh", { filePath });
        console.log("Profile cache cleared for:", filePath);
      }

      // Get or build dataset profile
      const profile = await this.getDatasetProfile(filePath, jsonData);

      // Convert to table format using profile
      const result = this.convertToTableFormat(jsonData, profile, opts);

      // Add raw data for AutoTable
      result.rawData = jsonData;

      log("DEBUG", "JSON file read successfully with schema inference", {
        filePath,
        totalRows: result.total,
        visibleColumns: Object.values(profile.columns).filter((c) => c.visible)
          .length,
        childTables: Object.keys(profile.children).length,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });

      return result;
    } catch (error) {
      log("ERROR", "Failed to read JSON file", {
        filePath,
        error: error.message,
      });
      throw new Error(`Failed to read JSON file: ${error.message}`);
    }
  }

  /**
   * Determine the best display mode for the JSON data
   */
  determineDisplayMode(jsonData) {
    if (Array.isArray(jsonData)) {
      // Check if it's an array of objects
      if (
        jsonData.length > 0 &&
        typeof jsonData[0] === "object" &&
        jsonData[0] !== null
      ) {
        return "array";
      }
      // Array of primitives - use hybrid mode
      return "hybrid";
    } else if (typeof jsonData === "object" && jsonData !== null) {
      // Single object - check if it has nested objects/arrays
      const hasNestedObjects = this.hasNestedObjects(jsonData);
      if (hasNestedObjects) {
        return "flattened";
      }
      return "flattened"; // Simple object, still use flattened mode
    }
    return "hybrid"; // Primitive values
  }

  /**
   * Check if object has nested objects or arrays
   */
  hasNestedObjects(obj) {
    for (const value of Object.values(obj)) {
      if (typeof value === "object" && value !== null) {
        return true;
      }
    }
    return false;
  }

  /**
   * Flatten an object using dot notation
   */
  flattenObject(obj, prefix = "") {
    const flattened = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (
          typeof obj[key] === "object" &&
          obj[key] !== null &&
          !Array.isArray(obj[key])
        ) {
          // Recursively flatten nested objects
          Object.assign(flattened, this.flattenObject(obj[key], newKey));
        } else if (Array.isArray(obj[key])) {
          // Handle arrays - show as JSON string for now
          flattened[newKey] = JSON.stringify(obj[key]);
        } else {
          // Primitive values
          flattened[newKey] = obj[key];
        }
      }
    }

    return flattened;
  }

  /**
   * Get metadata for JSON file using schema inference
   */
  async getJsonMeta(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const jsonData = JSON.parse(content);

      // Get dataset profile
      const profile = await this.getDatasetProfile(filePath, jsonData);

      // Get visible columns
      const visibleColumns = Object.entries(profile.columns)
        .filter(([path, config]) => config.visible)
        .map(([path, config]) => path);

      // Get child table columns
      const childColumns = Object.keys(profile.children);

      // All headers (visible + child tables)
      const allHeaders = ["#", ...visibleColumns, ...childColumns];

      return {
        sheets: [
          {
            name: "data",
            rows: profile.totalRows,
            headers: allHeaders,
            totalRows: profile.totalRows,
            displayMode: "schemaInferred",
            visibleColumns: visibleColumns,
            childTables: childColumns,
            profile: {
              totalColumns: Object.keys(profile.columns).length,
              visibleColumns: visibleColumns.length,
              childTables: childColumns.length,
              maxDepth: profile.maxDepth,
              sampleSize: profile.sampleSize,
            },
          },
        ],
        totalSheets: 1,
        fileType: "json",
        displayMode: "schemaInferred",
        profile: profile,
      };
    } catch (error) {
      log("ERROR", "Failed to get JSON metadata", {
        filePath,
        error: error.message,
      });
      throw new Error(`Failed to get JSON metadata: ${error.message}`);
    }
  }

  /**
   * CRUD operations for JSON files
   */
  async createRow(filePath, rowData) {
    try {
      log("INFO", "Creating row in JSON file", { filePath, rowData });

      const jsonData = await this.getJsonData(filePath);

      // Remove the '#' field if it exists (it's auto-generated)
      const cleanRowData = { ...rowData };
      delete cleanRowData["#"];

      if (Array.isArray(jsonData)) {
        // Array of objects - add new row
        jsonData.push(cleanRowData);
        await this.saveJsonData(filePath, jsonData);

        // Clear profile cache to force re-analysis
        this.profiles.delete(filePath);
        console.log(
          "Profile cache cleared after createRow (array) for:",
          filePath
        );

        return cleanRowData;
      } else if (typeof jsonData === "object" && jsonData !== null) {
        // Single object - merge new data into existing object
        const updatedData = this.updateNestedProperties(jsonData, cleanRowData);
        await this.saveJsonData(filePath, updatedData);

        // Clear profile cache to force re-analysis
        this.profiles.delete(filePath);
        console.log(
          "Profile cache cleared after createRow (object) for:",
          filePath
        );

        return cleanRowData;
      }

      throw new Error("Unsupported JSON structure for creating rows");
    } catch (error) {
      log("ERROR", "Failed to create row", { filePath, error: error.message });
      throw new Error(`Failed to create row: ${error.message}`);
    }
  }

  async updateRow(filePath, rowNumber, updates) {
    try {
      log("INFO", "Updating row in JSON file", {
        filePath,
        rowNumber,
        updates,
      });

      const jsonData = await this.getJsonData(filePath);

      // Remove the '#' field from updates (it's auto-generated)
      const cleanUpdates = { ...updates };
      delete cleanUpdates["#"];

      // Handle updates based on data structure
      if (Array.isArray(jsonData)) {
        // Array of objects - update specific row
        const index = rowNumber - 1; // Convert 1-based to 0-based
        if (index >= 0 && index < jsonData.length) {
          // Apply updates using dot notation for nested properties
          const updatedItem = this.updateNestedProperties(
            jsonData[index],
            cleanUpdates
          );
          jsonData[index] = updatedItem;
          await this.saveJsonData(filePath, jsonData);

          // Clear profile cache to force re-analysis
          this.profiles.delete(filePath);

          return updatedItem;
        }
        throw new Error(`Row ${rowNumber} not found`);
      } else if (typeof jsonData === "object" && jsonData !== null) {
        // Single object - update the object directly
        const updatedData = this.updateNestedProperties(jsonData, cleanUpdates);
        await this.saveJsonData(filePath, updatedData);

        // Clear profile cache to force re-analysis
        this.profiles.delete(filePath);

        return updatedData;
      }

      throw new Error("Unsupported JSON structure for updates");
    } catch (error) {
      log("ERROR", "Failed to update row", {
        filePath,
        rowNumber,
        error: error.message,
      });
      throw new Error(`Failed to update row: ${error.message}`);
    }
  }

  /**
   * Update nested properties in an object using dot notation
   */
  updateNestedProperties(obj, updates) {
    const result = JSON.parse(JSON.stringify(obj)); // Deep clone

    for (const [key, value] of Object.entries(updates)) {
      if (key.includes(".")) {
        // Handle dot notation (e.g., "data.TYPE")
        this.setNestedProperty(result, key, value);
      } else {
        // Handle top-level properties
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Set a nested property using dot notation
   */
  setNestedProperty(obj, path, value) {
    const keys = path.split(".");
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (
        !(key in current) ||
        typeof current[key] !== "object" ||
        current[key] === null
      ) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  async deleteRow(filePath, rowNumber) {
    try {
      log("INFO", "Deleting row from JSON file", { filePath, rowNumber });

      const jsonData = await this.getJsonData(filePath);

      if (Array.isArray(jsonData)) {
        // Array of objects - delete specific row
        const index = rowNumber - 1; // Convert 1-based to 0-based
        if (index >= 0 && index < jsonData.length) {
          const deletedRow = jsonData.splice(index, 1)[0];
          await this.saveJsonData(filePath, jsonData);

          // Clear profile cache to force re-analysis
          this.profiles.delete(filePath);

          log("INFO", "Row deleted successfully", {
            filePath,
            rowNumber,
            deletedRow,
          });
          return true;
        }
        throw new Error(`Row ${rowNumber} not found`);
      } else if (typeof jsonData === "object" && jsonData !== null) {
        // Single object - cannot delete, but could clear all data
        throw new Error(
          "Cannot delete row from single object JSON. Use edit mode to modify data."
        );
      }

      throw new Error("Unsupported JSON structure for deleting rows");
    } catch (error) {
      log("ERROR", "Failed to delete row", {
        filePath,
        rowNumber,
        error: error.message,
      });
      throw new Error(`Failed to delete row: ${error.message}`);
    }
  }

  /**
   * Check if file is a JSON file
   */
  isJsonFile(filePath) {
    return path.extname(filePath).toLowerCase() === ".json";
  }

  /**
   * Validate JSON file structure
   */
  async validateJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const jsonData = JSON.parse(content);

      // Handle different JSON structures
      if (Array.isArray(jsonData)) {
        if (jsonData.length === 0) {
          return { valid: true, warning: "JSON file is empty array" };
        }

        // Check if all objects have consistent structure
        const firstKeys = Object.keys(jsonData[0]);
        const inconsistentRows = jsonData.filter(
          (row) =>
            Object.keys(row).length !== firstKeys.length ||
            !firstKeys.every((key) => key in row)
        );

        if (inconsistentRows.length > 0) {
          return {
            valid: true,
            warning: `${inconsistentRows.length} rows have inconsistent structure`,
          };
        }

        return { valid: true };
      } else if (typeof jsonData === "object" && jsonData !== null) {
        // Single object is also valid
        return { valid: true, warning: "JSON file contains a single object" };
      } else {
        return {
          valid: false,
          error: "JSON file must contain an array or object",
        };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Build dataset profile by analyzing schema and structure
   */
  async buildDatasetProfile(filePath, jsonData) {
    try {
      log("INFO", "Building dataset profile", { filePath });

      const profile = {
        columns: {},
        children: {},
        maxDepth: 0,
        totalRows: 0,
        sampleSize: 0,
        lastUpdated: Date.now(),
      };

      // Determine if it's an array of objects or single object
      if (Array.isArray(jsonData)) {
        profile.totalRows = jsonData.length;
        profile.sampleSize = Math.min(jsonData.length, this.sampleSize);

        // Analyze first N rows for schema inference
        const sample = jsonData.slice(0, profile.sampleSize);
        const schema = this.analyzeSchema(sample);

        profile.columns = schema.columns;
        profile.children = schema.children;
        profile.maxDepth = schema.maxDepth;
      } else if (typeof jsonData === "object" && jsonData !== null) {
        profile.totalRows = 1;
        profile.sampleSize = 1;

        const schema = this.analyzeSchema([jsonData]);
        profile.columns = schema.columns;
        profile.children = schema.children;
        profile.maxDepth = schema.maxDepth;
      }

      // Rank columns by coverage and select visible ones
      this.rankAndSelectColumns(profile);

      // Cache the profile
      this.profiles.set(filePath, profile);

      log("INFO", "Dataset profile built", {
        filePath,
        totalColumns: Object.keys(profile.columns).length,
        visibleColumns: Object.values(profile.columns).filter((c) => c.visible)
          .length,
        childTables: Object.keys(profile.children).length,
      });

      return profile;
    } catch (error) {
      log("ERROR", "Failed to build dataset profile", {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Analyze schema from sample data
   */
  analyzeSchema(sampleData) {
    const columnStats = new Map();
    const childPaths = new Map();
    let maxDepth = 0;

    for (const item of sampleData) {
      const analysis = this.analyzeItem(item, "", 0);

      // Update max depth
      maxDepth = Math.max(maxDepth, analysis.depth);

      // Collect column statistics
      for (const [path, info] of analysis.columns) {
        if (!columnStats.has(path)) {
          columnStats.set(path, {
            type: info.type,
            count: 0,
            examples: new Set(),
            isArray: info.isArray,
            isObject: info.isObject,
          });
        }

        const stats = columnStats.get(path);
        stats.count++;

        if (info.value !== undefined && info.value !== null) {
          stats.examples.add(JSON.stringify(info.value).substring(0, 100));
        }
      }

      // Collect child table paths
      for (const [path, info] of analysis.children) {
        if (!childPaths.has(path)) {
          childPaths.set(path, {
            type: "arrayObject",
            count: 0,
            primaryKey: this.guessPrimaryKey(info.sample),
            visibleColumns: this.guessVisibleColumns(info.sample),
          });
        }
        childPaths.get(path).count++;
      }
    }

    // Convert to profile format
    const columns = {};
    for (const [path, stats] of columnStats) {
      columns[path] = {
        type: stats.type,
        coverage: stats.count / sampleData.length,
        examples: Array.from(stats.examples).slice(0, 3),
        isArray: stats.isArray,
        isObject: stats.isObject,
        visible: false, // Will be set by rankAndSelectColumns
        render: this.determineRenderStrategy(stats),
      };
    }

    const children = {};
    for (const [path, info] of childPaths) {
      children[path] = {
        type: info.type,
        coverage: info.count / sampleData.length,
        primaryKey: info.primaryKey,
        visibleColumns: info.visibleColumns,
      };
    }

    return { columns, children, maxDepth };
  }

  /**
   * Check if an object has complex nested structures
   */
  isComplexNestedStructure(obj) {
    if (typeof obj !== "object" || obj === null) return false;

    let complexity = 0;
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.length > 0) {
        complexity += value.length;
      } else if (typeof value === "object" && value !== null) {
        complexity += 1;
      }
      if (complexity > 5) return true; // Consider complex if more than 5 nested items
    }
    return false;
  }

  /**
   * Analyze a single item recursively
   */
  analyzeItem(item, prefix, depth) {
    const columns = new Map();
    const children = new Map();
    let maxDepth = depth;

    if (depth > this.maxDepth) {
      return { columns, children, depth };
    }

    if (typeof item === "object" && item !== null) {
      if (Array.isArray(item)) {
        // Handle arrays
        if (item.length > 0) {
          const firstItem = item[0];
          if (typeof firstItem === "object" && firstItem !== null) {
            // Array of objects - potential child table
            children.set(prefix, {
              sample: item.slice(0, 5), // Sample for analysis
              count: item.length,
            });
          } else {
            // Array of scalars
            columns.set(prefix, {
              type: "arrayScalar",
              value: item,
              isArray: true,
              isObject: false,
            });
          }
        }
      } else {
        // Handle objects
        for (const [key, value] of Object.entries(item)) {
          const newPrefix = prefix ? `${prefix}.${key}` : key;

          if (typeof value === "object" && value !== null) {
            if (Array.isArray(value)) {
              if (
                value.length > 0 &&
                typeof value[0] === "object" &&
                value[0] !== null
              ) {
                // Array of objects - decide whether to treat as child table or flatten
                // If the array has many items (>10) or complex nested structures, treat as child table
                // Otherwise, flatten the first few items as columns
                if (
                  value.length > 10 ||
                  this.isComplexNestedStructure(value[0])
                ) {
                  children.set(newPrefix, {
                    sample: value.slice(0, 5),
                    count: value.length,
                  });
                } else {
                  // Flatten array items as individual columns
                  for (let i = 0; i < Math.min(value.length, 5); i++) {
                    const item = value[i];
                    if (typeof item === "object" && item !== null) {
                      // Flatten this object's properties
                      for (const [itemKey, itemValue] of Object.entries(item)) {
                        const itemPath = `${newPrefix}[${i}].${itemKey}`;
                        columns.set(itemPath, {
                          type: typeof itemValue,
                          value: itemValue,
                          isArray: false,
                          isObject: false,
                        });
                      }
                    }
                  }
                }
              } else {
                // Array of scalars
                columns.set(newPrefix, {
                  type: "arrayScalar",
                  value: value,
                  isArray: true,
                  isObject: false,
                });
              }
            } else {
              // Nested object - recurse
              const nested = this.analyzeItem(value, newPrefix, depth + 1);
              maxDepth = Math.max(maxDepth, nested.depth);

              // Merge nested results
              for (const [path, info] of nested.columns) {
                columns.set(path, info);
              }
              for (const [path, info] of nested.children) {
                children.set(path, info);
              }
            }
          } else {
            // Scalar value
            columns.set(newPrefix, {
              type: typeof value,
              value: value,
              isArray: false,
              isObject: false,
            });
          }
        }
      }
    } else {
      // Scalar value at root
      columns.set(prefix || "value", {
        type: typeof item,
        value: item,
        isArray: false,
        isObject: false,
      });
    }

    return { columns, children, depth: maxDepth };
  }

  /**
   * Rank columns by coverage and select visible ones
   */
  rankAndSelectColumns(profile) {
    const columns = Object.entries(profile.columns);

    // Sort by coverage (descending)
    columns.sort((a, b) => b[1].coverage - a[1].coverage);

    // Select top columns for visibility
    const visibleCount = Math.min(this.maxVisibleColumns, columns.length);
    for (let i = 0; i < visibleCount; i++) {
      profile.columns[columns[i][0]].visible = true;
    }

    // Mark remaining as hidden
    for (let i = visibleCount; i < columns.length; i++) {
      profile.columns[columns[i][0]].visible = false;
    }
  }

  /**
   * Determine render strategy for a column
   */
  determineRenderStrategy(stats) {
    if (stats.isArray) {
      if (stats.type === "arrayScalar") {
        return "join"; // Join array elements with comma
      }
      return "length"; // Show array length
    }

    if (stats.type === "object") {
      return "json"; // Show as JSON preview
    }

    return "text"; // Default text rendering
  }

  /**
   * Guess primary key for child table
   */
  guessPrimaryKey(sample) {
    const commonKeys = ["id", "uuid", "key", "pk", "primaryKey"];

    for (const key of commonKeys) {
      if (
        sample.every((item) => item && typeof item === "object" && key in item)
      ) {
        return key;
      }
    }

    // If no common key found, use first available key
    if (sample.length > 0 && sample[0] && typeof sample[0] === "object") {
      const keys = Object.keys(sample[0]);
      if (keys.length > 0) {
        return keys[0];
      }
    }

    return null;
  }

  /**
   * Guess visible columns for child table
   */
  guessVisibleColumns(sample) {
    if (sample.length === 0) return [];

    const allKeys = new Set();
    for (const item of sample) {
      if (item && typeof item === "object") {
        Object.keys(item).forEach((key) => allKeys.add(key));
      }
    }

    // Prioritize common keys
    const priorityKeys = [
      "id",
      "name",
      "title",
      "status",
      "type",
      "date",
      "created",
      "updated",
    ];
    const visibleKeys = [];

    // Add priority keys first
    for (const key of priorityKeys) {
      if (allKeys.has(key)) {
        visibleKeys.push(key);
        allKeys.delete(key);
      }
    }

    // Add remaining keys (limit to 10 total)
    const remainingKeys = Array.from(allKeys).slice(0, 10 - visibleKeys.length);
    visibleKeys.push(...remainingKeys);

    return visibleKeys;
  }

  /**
   * Get or build dataset profile
   */
  async getDatasetProfile(filePath, jsonData) {
    // Check cache first
    if (this.profiles.has(filePath)) {
      const profile = this.profiles.get(filePath);
      // Check if profile is still valid (could add TTL here)
      return profile;
    }

    // Build new profile
    return await this.buildDatasetProfile(filePath, jsonData);
  }

  /**
   * Convert JSON data to table format using dataset profile
   */
  convertToTableFormat(jsonData, profile, opts = {}) {
    const page = opts.page || 1;
    const pageSize = opts.pageSize || 25;

    // Get visible columns from profile
    const visibleColumns = Object.entries(profile.columns)
      .filter(([path, config]) => config.visible)
      .map(([path, config]) => ({ path, ...config }));

    // Add child table columns
    const childColumns = Object.entries(profile.children).map(
      ([path, config]) => ({
        path,
        type: "childTable",
        ...config,
      })
    );

    // Create headers (simple strings for ExcelGrid compatibility)
    const headers = [
      "#",
      ...visibleColumns.map((col) => col.path),
      ...childColumns.map((col) => col.path),
    ];

    // Store header metadata separately for future use
    const headerMetadata = {
      "#": { key: "#", label: "#", type: "number" },
      ...visibleColumns.reduce((acc, col) => {
        acc[col.path] = {
          key: col.path,
          label: col.path,
          type: col.type,
          render: col.render,
          coverage: col.coverage,
        };
        return acc;
      }, {}),
      ...childColumns.reduce((acc, col) => {
        acc[col.path] = {
          key: col.path,
          label: col.path,
          type: "childTable",
          primaryKey: col.primaryKey,
          visibleColumns: col.visibleColumns,
        };
        return acc;
      }, {}),
    };

    // Convert data to rows
    let rows = [];
    if (Array.isArray(jsonData)) {
      rows = jsonData.map((item, index) => {
        const row = { "#": index + 1 };

        // Add visible column values
        for (const col of visibleColumns) {
          const value = this.getValueByPath(item, col.path);
          row[col.path] = this.renderValue(value, col);
        }

        // Add child table info
        for (const col of childColumns) {
          const childData = this.getValueByPath(item, col.path);
          if (Array.isArray(childData)) {
            row[col.path] = `${childData.length} items`;
            row[`${col.path}_data`] = childData; // Store raw data for child table
          } else {
            row[col.path] = "0 items";
            row[`${col.path}_data`] = [];
          }
        }

        return row;
      });
    } else if (typeof jsonData === "object" && jsonData !== null) {
      // Single object - create one row
      const row = { "#": 1 };

      // Add visible column values
      for (const col of visibleColumns) {
        const value = this.getValueByPath(jsonData, col.path);
        row[col.path] = this.renderValue(value, col);
      }

      // Add child table info
      for (const col of childColumns) {
        const childData = this.getValueByPath(jsonData, col.path);
        if (Array.isArray(childData)) {
          row[col.path] = `${childData.length} items`;
          row[`${col.path}_data`] = childData;
        } else {
          row[col.path] = "0 items";
          row[`${col.path}_data`] = [];
        }
      }

      rows = [row];
    }

    // Apply pagination
    const total = rows.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRows = rows.slice(startIndex, endIndex);

    return {
      headers,
      headerMetadata,
      rows: paginatedRows,
      total,
      page,
      pageSize,
      totalPages,
      profile: {
        totalColumns: Object.keys(profile.columns).length,
        visibleColumns: visibleColumns.length,
        childTables: childColumns.length,
        maxDepth: profile.maxDepth,
      },
    };
  }

  /**
   * Get value by dot-notation path (supports array indices like [0])
   */
  getValueByPath(obj, path) {
    if (!path) return obj;

    return path.split(".").reduce((current, key) => {
      if (current && typeof current === "object") {
        // Handle array indices like "pageConfig[0]"
        if (key.includes("[") && key.includes("]")) {
          const arrayKey = key.substring(0, key.indexOf("["));
          const indexStr = key.substring(
            key.indexOf("[") + 1,
            key.indexOf("]")
          );
          const index = parseInt(indexStr, 10);

          if (
            arrayKey in current &&
            Array.isArray(current[arrayKey]) &&
            index >= 0 &&
            index < current[arrayKey].length
          ) {
            return current[arrayKey][index];
          }
        } else if (key in current) {
          return current[key];
        }
      }
      return undefined;
    }, obj);
  }

  /**
   * Render value based on column configuration
   */
  renderValue(value, column) {
    if (value === undefined || value === null) {
      return "";
    }

    switch (column.render) {
      case "join":
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        return String(value);

      case "length":
        if (Array.isArray(value)) {
          return value.length.toString();
        }
        return "0";

      case "json":
        if (typeof value === "object") {
          const jsonStr = JSON.stringify(value);
          return jsonStr.length > 100
            ? jsonStr.substring(0, 97) + "..."
            : jsonStr;
        }
        return String(value);

      case "text":
      default:
        return String(value);
    }
  }

  /**
   * Update column configuration
   */
  async updateColumnConfig(filePath, columnPath, config) {
    try {
      log("INFO", "Updating column configuration", {
        filePath,
        columnPath,
        config,
      });

      // Get current profile
      const profile = this.profiles.get(filePath);
      if (!profile) {
        throw new Error("Profile not found for file");
      }

      // Update column configuration
      if (profile.columns[columnPath]) {
        profile.columns[columnPath] = {
          ...profile.columns[columnPath],
          ...config,
        };

        // Update cache
        this.profiles.set(filePath, profile);

        log("INFO", "Column configuration updated", { filePath, columnPath });
        return { success: true };
      } else {
        throw new Error(`Column ${columnPath} not found in profile`);
      }
    } catch (error) {
      log("ERROR", "Failed to update column configuration", {
        filePath,
        columnPath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update child table configuration
   */
  async updateChildTableConfig(filePath, childPath, config) {
    try {
      log("INFO", "Updating child table configuration", {
        filePath,
        childPath,
        config,
      });

      // Get current profile
      const profile = this.profiles.get(filePath);
      if (!profile) {
        throw new Error("Profile not found for file");
      }

      // Update child table configuration
      if (profile.children[childPath]) {
        profile.children[childPath] = {
          ...profile.children[childPath],
          ...config,
        };

        // Update cache
        this.profiles.set(filePath, profile);

        log("INFO", "Child table configuration updated", {
          filePath,
          childPath,
        });
        return { success: true };
      } else {
        throw new Error(`Child table ${childPath} not found in profile`);
      }
    } catch (error) {
      log("ERROR", "Failed to update child table configuration", {
        filePath,
        childPath,
        error: error.message,
      });
      throw error;
    }
  }

  // Helper methods
  async getJsonData(filePath) {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  }

  async saveJsonData(filePath, jsonData) {
    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2));
  }

  /**
   * Export JSON data to a file
   */
  async export(fileName, exportPath) {
    try {
      log("INFO", "Exporting JSON data", { fileName, exportPath });

      // Get all collections for this dataset
      const expectedCollections = [
        "pages",
        "page_elements",
        "testsets",
        "testcases",
        "steps",
        "application",
      ];

      const collections = {};
      for (const collectionName of expectedCollections) {
        try {
          const data = await collectionStore.listRows({
            collection: collectionName,
          });
          if (data.length > 0) {
            collections[collectionName] = data;
          }
        } catch (e) {
          // Collection might not exist, continue
        }
      }

      // Recompose to JSON format
      const recomposedJson = await normalizationService.recomposeJsonData(
        collections
      );

      // Write to export path
      await fs.writeFile(exportPath, JSON.stringify(recomposedJson, null, 2));

      log("INFO", "JSON exported successfully", {
        fileName,
        exportPath,
        collections: Object.keys(collections),
      });

      return { success: true, path: exportPath };
    } catch (error) {
      log("ERROR", "JSON export failed", {
        fileName,
        exportPath,
        error: error.message,
      });
      throw new Error(`Failed to export JSON: ${error.message}`);
    }
  }
}

module.exports = new JsonService();
