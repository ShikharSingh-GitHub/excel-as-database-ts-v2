const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const properLockfile = require("proper-lockfile");

// Use the same logging function as excelService
const log = (level, message, ctx) => {
  try {
    const ts = new Date().toISOString();
    const line =
      `${ts} [${level}] ${message}` + (ctx ? " " + JSON.stringify(ctx) : "");
    console.log(line);
  } catch (e) {
    console.error("Logging error:", e);
  }
};

/**
 * Collection-based CRUD store with optimistic concurrency
 * Each collection is backed by a JSON file with proper locking
 */
class CollectionStore {
  constructor() {
    this.cache = new Map(); // collection name -> { rows, ts, mtime }
    this.cacheTTL = 2000; // 2 seconds
    this.lockTimeout = 5000; // 5 seconds
  }

  /**
   * Get the file path for a collection
   */
  getCollectionPath(collectionName) {
    const config = require("./excelService").readConfig();
    const folderPath = config.folderPath;
    return path.join(folderPath, `${collectionName}.json`);
  }

  /**
   * Read a collection from disk with caching
   */
  async readCollection(collectionName) {
    const filePath = this.getCollectionPath(collectionName);
    const now = Date.now();

    try {
      // Check if file exists
      if (!fsSync.existsSync(filePath)) {
        // Return empty array for non-existent files
        return [];
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      const mtime = stats.mtime.getTime();

      // Check cache
      const cached = this.cache.get(collectionName);
      if (cached && now - cached.ts < this.cacheTTL && cached.mtime === mtime) {
        return cached.rows;
      }

      // Read from disk
      const content = await fs.readFile(filePath, "utf8");
      const rows = JSON.parse(content);

      // Update cache
      this.cache.set(collectionName, {
        rows,
        ts: now,
        mtime,
      });

      log("DEBUG", "Collection read from disk", {
        collection: collectionName,
        rows: rows.length,
      });

      return rows;
    } catch (error) {
      // If file doesn't exist or is corrupted, return empty array
      if (error.code === "ENOENT") {
        return [];
      }

      log("ERROR", "Failed to read collection", {
        collection: collectionName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Write a collection to disk with atomic operations
   */
  async writeCollection(collectionName, rows) {
    const filePath = this.getCollectionPath(collectionName);
    const tempPath = `${filePath}.tmp`;
    const dirPath = path.dirname(filePath);

    try {
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Create empty file if it doesn't exist (needed for proper-lockfile)
      if (!fsSync.existsSync(filePath)) {
        await fs.writeFile(filePath, "[]");
      }

      // Acquire lock
      const release = await properLockfile.lock(filePath, {
        retries: 3,
        retryDelay: 100,
      });

      try {
        // Write to temporary file
        await fs.writeFile(tempPath, JSON.stringify(rows, null, 2));

        // Atomic rename
        await fs.rename(tempPath, filePath);

        // Invalidate cache
        this.cache.delete(collectionName);

        log("DEBUG", "Collection written to disk", {
          collection: collectionName,
          rows: rows.length,
        });
      } finally {
        await release();
      }
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }

      log("ERROR", "Failed to write collection", {
        collection: collectionName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate a unique ID for a collection
   */
  generateId(collectionName, rows) {
    // Use ULID for better uniqueness and sortability
    return uuidv4();
  }

  /**
   * List rows from a collection with optional filtering
   */
  async listRows({ collection, filter = {} }) {
    const rows = await this.readCollection(collection);

    if (!filter || Object.keys(filter).length === 0) {
      return rows;
    }

    return rows.filter((row) =>
      Object.entries(filter).every(([key, value]) => row[key] === value)
    );
  }

  /**
   * Create a new row in a collection
   */
  async createRow({ collection, row }) {
    const rows = await this.readCollection(collection);
    const now = new Date().toISOString();

    // Generate ID if not provided
    const id = row.id || this.generateId(collection, rows);

    const newRow = {
      ...row,
      id,
      _version: 1,
      _created_at: now,
      _updated_at: now,
    };

    rows.push(newRow);
    await this.writeCollection(collection, rows);

    log("INFO", "Row created", {
      collection,
      id,
    });

    return newRow;
  }

  /**
   * Update a row in a collection with optimistic concurrency
   */
  async updateRow({ collection, id, expectedVersion, patch }) {
    const rows = await this.readCollection(collection);
    const index = rows.findIndex((row) => row.id === id);

    if (index < 0) {
      throw new Error(`Row not found: ${id}`);
    }

    const current = rows[index];

    // Check version for optimistic concurrency
    if (current._version !== expectedVersion) {
      return {
        conflict: true,
        latest: current,
      };
    }

    const updated = {
      ...current,
      ...patch,
      _version: current._version + 1,
      _updated_at: new Date().toISOString(),
    };

    rows[index] = updated;
    await this.writeCollection(collection, rows);

    log("INFO", "Row updated", {
      collection,
      id,
      version: updated._version,
    });

    return {
      ok: true,
      row: updated,
    };
  }

  /**
   * Delete a row from a collection with optimistic concurrency
   */
  async deleteRow({ collection, id, expectedVersion }) {
    const rows = await this.readCollection(collection);
    const index = rows.findIndex((row) => row.id === id);

    if (index < 0) {
      throw new Error(`Row not found: ${id}`);
    }

    const current = rows[index];

    // Check version for optimistic concurrency
    if (current._version !== expectedVersion) {
      return {
        conflict: true,
        latest: current,
      };
    }

    rows.splice(index, 1);
    await this.writeCollection(collection, rows);

    log("INFO", "Row deleted", {
      collection,
      id,
    });

    return {
      ok: true,
    };
  }

  /**
   * Get collection metadata
   */
  async getCollectionMeta(collectionName) {
    const rows = await this.readCollection(collectionName);
    return {
      name: collectionName,
      count: rows.length,
      columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    };
  }

  /**
   * Clear cache for a collection
   */
  clearCache(collectionName) {
    this.cache.delete(collectionName);
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.cache.clear();
  }
}

// Export singleton instance
module.exports = new CollectionStore();
