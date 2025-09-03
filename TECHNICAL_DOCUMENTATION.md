# Technical Documentation - Excel Database Electron

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Data Flow](#data-flow)
4. [File Operations](#file-operations)
5. [XLSM Handling](#xlsm-handling)
6. [CRUD Operations](#crud-operations)
7. [Configuration System](#configuration-system)
8. [Error Handling](#error-handling)
9. [Performance Optimizations](#performance-optimizations)
10. [Security Considerations](#security-considerations)
11. [Development Guidelines](#development-guidelines)
12. [API Reference](#api-reference)

## Architecture Overview

### Technology Stack

```
Frontend (Renderer Process):
├── React 18 + TypeScript
├── Tailwind CSS (styling)
├── Lucide React (icons)
└── Vite (build tool)

Backend (Main Process):
├── Electron 31+
├── Node.js 20+
├── SheetJS (XLSX operations)
├── ExcelJS (XLSM operations)
└── proper-lockfile (file locking)
```

### Process Architecture

```
┌─────────────────┐    IPC    ┌─────────────────┐
│   Main Process  │ ◄────────► │ Renderer Process│
│                 │           │                 │
│ • File I/O      │           │ • UI Components │
│ • Excel Parsing │           │ • State Mgmt    │
│ • Configuration │           │ • User Events   │
│ • Caching       │           │ • Data Display  │
└─────────────────┘           └─────────────────┘
```

## Core Components

### Frontend Components

#### App.tsx (Main Application)

- **Purpose**: Central state management and coordination
- **Key Features**:
  - File and workbook state management
  - Sheet data loading and caching
  - CRUD operation coordination
  - Error handling and user feedback

#### ExcelGrid.tsx (Data Grid)

- **Purpose**: Editable data display with sorting/filtering
- **Key Features**:
  - Inline cell editing
  - Multi-column sorting
  - Real-time filtering
  - Pagination
  - Context menu support

#### ExcelToolbar.tsx (Toolbar)

- **Purpose**: CRUD operations and file management
- **Key Features**:
  - Add/Edit/Delete row buttons
  - Sort controls
  - Export functionality
  - Clipboard operations

#### Sidebar.tsx (File Browser)

- **Purpose**: File and folder navigation
- **Key Features**:
  - Excel file listing
  - Folder selection
  - File metadata display
  - Refresh functionality

### Backend Services

#### excelService.js (Core Service)

- **Purpose**: Primary Excel file operations for XLSX files
- **Key Features**:
  - File reading and writing
  - Sheet data extraction
  - CRUD operations
  - Caching and invalidation
  - Configuration management

#### cleanXlsmService.js (XLSM Handler)

- **Purpose**: Specialized handling for XLSM files
- **Key Features**:
  - Macro stripping
  - Sidecar file management
  - Value patching
  - Formatting preservation

#### macroStripper.js (Macro Processing)

- **Purpose**: Convert XLSM to XLSX safely
- **Key Features**:
  - VBA project removal
  - Formatting preservation
  - ExcelJS-based conversion

#### valuePatcher.js (Value Updates)

- **Purpose**: Update cell values without losing formatting
- **Key Features**:
  - Targeted cell updates
  - Style preservation
  - Formula protection

## Data Flow

### File Loading Process

```
1. User selects file
   ↓
2. Main process reads workbook metadata
   ↓
3. Sheet names extracted and filtered
   ↓
4. Active sheet data loaded with pagination
   ↓
5. Data cached and sent to renderer
   ↓
6. UI updates with grid display
```

### CRUD Operation Flow

```
1. User initiates operation (add/edit/delete)
   ↓
2. Frontend validates input
   ↓
3. IPC call to main process
   ↓
4. File lock acquired
   ↓
5. Operation performed (atomic write)
   ↓
6. Cache invalidated
   ↓
7. UI refreshed with new data
   ↓
8. File lock released
```

## File Operations

### Atomic Write Pattern

```javascript
function writeWorkbookAtomic(filePath, workbook, bookType) {
  const tmp = path.join(dir, `.${base}.tmp.${Date.now()}`);

  try {
    // Write to temporary file
    XLSX.writeFile(workbook, tmp, options);

    // Atomic rename
    fs.renameSync(tmp, filePath);

    // Invalidate cache
    invalidateCache(filePath);
  } catch (error) {
    // Cleanup on failure
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    throw error;
  }
}
```

### File Locking

```javascript
async function acquireLock(filePath, opts = {}) {
  const timeout = opts.timeoutMs || 5000;
  const start = Date.now();

  while (true) {
    try {
      const release = await lockfile.lock(filePath, { realpath: false });
      return release;
    } catch (e) {
      if (Date.now() - start > timeout) {
        throw new Error("lock-timeout");
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}
```

### Caching Strategy

```javascript
const cache = new Map();

function cacheGet(key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function cacheSet(key, value, mtimeMs) {
  cache.set(key, { value, timestamp: Date.now(), mtimeMs });
}
```

## XLSM Handling

### Sidecar File Approach

```
Original XLSM File:
└── workbook.xlsm (with macros, formatting, formulas)

Working Copy:
└── workbook.working.xlsx (macros stripped, formatting preserved)
```

### Macro Stripping Process

```javascript
async function stripXlsmToXlsxWithExcelJS(xlsmPath, xlsxPath) {
  const workbook = new ExcelJS.Workbook();

  // Load XLSM with all features
  await workbook.xlsx.readFile(xlsmPath, {
    cellStyles: true,
    cellFormula: true,
    cellHTML: true,
  });

  // Remove VBA project
  workbook.removeWorksheet("_vba");

  // Save as XLSX with enhanced options
  await workbook.xlsx.writeFile(xlsxPath, {
    useStyles: true,
    useSharedStrings: true,
  });
}
```

### Value Patching

```javascript
async function patchValuesOnly(filePath, sheetName, patches) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath, { cellStyles: true });

  const worksheet = workbook.getWorksheet(sheetName);

  // Apply patches without affecting formatting
  patches.forEach((patch) => {
    const cell = worksheet.getCell(patch.address);
    cell.value = patch.value;
  });

  // Save with formatting preservation
  await workbook.xlsx.writeFile(filePath, {
    useStyles: true,
    useSharedStrings: true,
  });
}
```

## CRUD Operations

### Row Number-Based Approach

Instead of relying on primary keys, we use visible row numbers for CRUD operations:

```javascript
// Frontend: Convert 0-based index to 1-based row number
const rowNumber = rowIndex + 1;

// Backend: Convert 1-based row number to actual Excel row
const actualRowNumber = headerRowPosition + dataStartRow + rowIndex;
```

### Create Row

```javascript
async function createRow(filePath, sheetName, rowData) {
  // Find first empty row after existing data
  const emptyRowIndex = findFirstEmptyRow(sheetData);

  // Create patches for the new row
  const patches = Object.entries(rowData).map(([col, value]) => ({
    address: `${col}${emptyRowIndex}`,
    value: value,
  }));

  // Apply patches
  await patchValuesOnly(filePath, sheetName, patches);

  // Invalidate cache
  invalidateCache(filePath, sheetName);
}
```

### Update Row

```javascript
async function updateRow(filePath, sheetName, rowNumber, updates) {
  // Validate row number
  if (rowNumber < 1 || rowNumber > totalRows) {
    throw new Error("Invalid row number");
  }

  // Calculate actual Excel row
  const actualRow = headerRowPosition + dataStartRow + (rowNumber - 1);

  // Create patches for updates
  const patches = Object.entries(updates).map(([col, value]) => ({
    address: `${col}${actualRow}`,
    value: value,
  }));

  // Apply patches
  await patchValuesOnly(filePath, sheetName, patches);

  // Invalidate cache
  invalidateCache(filePath, sheetName);
}
```

### Delete Row

```javascript
async function deleteRow(filePath, sheetName, rowNumber) {
  // Instead of physically removing the row, clear all cell values
  const actualRow = headerRowPosition + dataStartRow + (rowNumber - 1);

  // Get all columns with data
  const columns = getDataColumns(sheetData);

  // Create patches to clear all cells in the row
  const patches = columns.map((col) => ({
    address: `${col}${actualRow}`,
    value: "",
  }));

  // Apply patches
  await patchValuesOnly(filePath, sheetName, patches);

  // Invalidate cache
  invalidateCache(filePath, sheetName);
}
```

## Configuration System

### Configuration Structure

```json
{
  "folderPath": "/path/to/excel/files",
  "pkName": "App ID",
  "cacheTtlMs": 2000,
  "pageSizeDefault": 25,
  "maxPageSize": 200,
  "autoRefreshSeconds": 0,
  "readOnlySheets": [],
  "ignoreSheets": ["Tags", "Step_Template", "backlog"],
  "headerRowConfig": {
    "workbook.xlsm": {
      "Sheet1": 4,
      "Sheet2": 4
    }
  },
  "xlsmConversion": {
    "enabled": true,
    "preserveVBA": true,
    "preserveFormulas": true,
    "preserveStyles": true,
    "autoConvert": true,
    "useBridge": false,
    "fallbackToExcelJS": true,
    "preferExcelJS": true,
    "preserveFormatting": true
  }
}
```

### Configuration Management

```javascript
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch (e) {
    return getDefaultConfig();
  }
}

function writeConfig(partial) {
  const cfg = Object.assign({}, readConfig(), partial);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
  return cfg;
}
```

## Error Handling

### Error Categories

1. **File System Errors**

   - File not found
   - Permission denied
   - File in use
   - Disk full

2. **Excel Format Errors**

   - Corrupted file
   - Unsupported format
   - Password protected
   - Macro execution disabled

3. **User Input Errors**
   - Invalid row selection
   - Invalid data types
   - Required fields missing
   - Version conflicts

### Error Handling Strategy

```javascript
// Graceful error handling with user feedback
try {
  const result = await performOperation();
  setToast("✅ Operation successful");
} catch (error) {
  const message = getErrorMessage(error);
  setToast(`❌ ${message}`);
  log("ERROR", "Operation failed", { error: error.message });
}
```

### Error Recovery

```javascript
// Automatic retry for transient errors
async function retryOperation(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (isTransientError(error)) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

## Performance Optimizations

### Caching Strategy

- **TTL-based caching**: 2-second cache with automatic invalidation
- **Selective invalidation**: Only invalidate affected files/sheets
- **Memory management**: Automatic cleanup of expired entries

### Pagination

- **Configurable page sizes**: 25-200 rows per page
- **Lazy loading**: Load data on demand
- **State preservation**: Maintain sort/filter state across pages

### File Operations

- **Atomic writes**: Prevent corruption during crashes
- **Value patching**: Minimal file writes for better performance
- **Async operations**: Non-blocking UI during file operations

### Memory Management

```javascript
// Automatic cleanup of unused resources
function cleanupResources() {
  // Clear expired cache entries
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > cacheTtl) {
      cache.delete(key);
    }
  }

  // Clear temporary files
  cleanupTempFiles();
}
```

## Security Considerations

### Local-Only Operation

- **No network access**: Application operates entirely locally
- **No data transmission**: All data stays on user's machine
- **No telemetry**: No usage data collection

### File System Security

- **Path validation**: Prevent directory traversal attacks
- **File type validation**: Only process Excel files
- **Permission checks**: Verify read/write permissions

### Input Validation

```javascript
function validateInput(data) {
  // Sanitize user input
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
```

## Development Guidelines

### Code Style

- **TypeScript**: Use strict mode for all frontend code
- **ESLint**: Follow consistent code style
- **Prettier**: Automatic code formatting
- **Comments**: Document complex logic and business rules

### Error Handling

- **Try-catch blocks**: Wrap all async operations
- **User feedback**: Always provide meaningful error messages
- **Logging**: Log errors with context for debugging
- **Graceful degradation**: Handle errors without crashing

### Testing

- **Unit tests**: Test individual functions and components
- **Integration tests**: Test file operations and CRUD workflows
- **E2E tests**: Test complete user workflows
- **Error testing**: Test error conditions and edge cases

### Performance

- **Lazy loading**: Load data and components on demand
- **Debouncing**: Debounce user input for better performance
- **Memoization**: Cache expensive calculations
- **Optimistic updates**: Update UI immediately, sync later

## API Reference

### Main Process APIs

#### File Operations

```javascript
// Get workbook metadata
ipcMain.handle("workbook:meta", async (event, filePath) => {
  return await excelService.getWorkbookMeta(filePath);
});

// Read sheet data
ipcMain.handle("sheet:read", async (event, filePath, sheetName, options) => {
  return await excelService.readSheet(filePath, sheetName, options);
});

// Create row
ipcMain.handle("sheet:create", async (event, filePath, sheetName, rowData) => {
  return await excelService.createRow(filePath, sheetName, rowData);
});

// Update row
ipcMain.handle(
  "sheet:update",
  async (event, filePath, sheetName, rowId, updates) => {
    return await excelService.updateRow(filePath, sheetName, rowId, updates);
  }
);

// Delete row
ipcMain.handle("sheet:delete", async (event, filePath, sheetName, rowId) => {
  return await excelService.deleteRow(filePath, sheetName, rowId);
});
```

#### Configuration

```javascript
// Read configuration
ipcMain.handle("config:read", async (event) => {
  return excelService.readConfig();
});

// Write configuration
ipcMain.handle("config:write", async (event, partial) => {
  return excelService.writeConfig(partial);
});

// Scan folder
ipcMain.handle("folder:scan", async (event, folderPath) => {
  return excelService.scanFolder(folderPath);
});
```

### Frontend APIs

#### File Management

```typescript
// Load workbook
const meta = await window.api.invoke("workbook:meta", filePath);

// Load sheet data
const sheetData = await window.api.invoke("sheet:read", filePath, sheetName, {
  page: 1,
  pageSize: 25,
  filter: "",
  sort: null,
});

// Create row
const result = await window.api.invoke(
  "sheet:create",
  filePath,
  sheetName,
  rowData
);

// Update row
const result = await window.api.invoke(
  "sheet:update",
  filePath,
  sheetName,
  rowNumber,
  updates
);

// Delete row
const result = await window.api.invoke(
  "sheet:delete",
  filePath,
  sheetName,
  rowNumber
);
```

#### Configuration

```typescript
// Read config
const config = await window.api.invoke("config:read");

// Write config
const newConfig = await window.api.invoke("config:write", {
  folderPath: "/new/path",
});

// Scan folder
const files = await window.api.invoke("folder:scan", folderPath);
```

---

This technical documentation provides a comprehensive overview of the Excel Database Electron application's architecture, implementation details, and development guidelines. For specific implementation questions, refer to the source code and inline documentation.
