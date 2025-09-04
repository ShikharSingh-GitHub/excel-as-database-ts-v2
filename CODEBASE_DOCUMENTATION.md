# 🏗️ Excel Database Electron - Comprehensive Codebase Documentation

## 📋 Project Overview

This is a **sophisticated Electron-based desktop application** that serves as a **hybrid Excel and JSON database management system**. It allows users to:

- Work with Excel files (XLSX/XLSM) in a spreadsheet-like interface
- Import and manage JSON data as collections
- Perform CRUD operations on both Excel and JSON data
- Export data between formats
- Handle complex data normalization and schema inference

---

## 🏛️ Architecture Overview

### **Core Architecture Pattern:**

- **Main Process (Node.js)**: Handles file operations, data processing, and business logic
- **Renderer Process (React/TypeScript)**: Provides the user interface
- **IPC Communication**: Secure communication between processes via `contextBridge`

### **Data Flow:**

```
User Interface (React) → IPC → Main Process → File System/APIs → Database/Excel Files
```

---

## 📁 Directory Structure Deep Dive

### **1. Root Level Files**

- **`package.json`**: Project configuration with Electron, React, and Excel/JSON processing dependencies
- **`config.json`**: Global application configuration including folder paths, primary keys, and UI settings
- **`vite.config.ts`**: Vite build configuration for the renderer process
- **`tailwind.config.ts`**: Tailwind CSS configuration for styling

### **2. `src/` Directory**

#### **`src/main.js`** - **Main Process Entry Point**

- **Purpose**: Electron main process that manages the application lifecycle
- **Key Responsibilities**:
  - Window management and creation
  - IPC handler registration for all operations
  - Service orchestration (Excel, JSON, Collections)
  - Error handling and logging

#### **`src/preload.js`** - **Secure API Bridge**

- **Purpose**: Exposes safe APIs to the renderer process
- **Key Features**:
  - Uses `contextBridge` for security
  - Provides organized API namespaces (`config`, `folder`, `workbook`, `sheet`, `json`, `collection`, `normalize`)
  - Prevents direct access to Node.js APIs from renderer

#### **`src/electron/`** - **Backend Services**

**`excelService.js`** - **Excel File Management**

- **Core Functionality**:
  - Excel file reading/writing using SheetJS
  - Workbook metadata extraction
  - Sheet management and CRUD operations
  - Configuration management
  - Caching and performance optimization
- **Key Methods**:
  - `readWorkbook()`, `writeWorkbook()`
  - `getWorkbookMeta()`, `readSheet()`
  - `createRow()`, `updateRow()`, `deleteRow()`

**`cleanXlsmService.js`** - **XLSM File Handler**

- **Purpose**: Handles Excel files with macros (XLSM)
- **Key Features**:
  - Strips macros and creates clean XLSX copies
  - Preserves formatting and formulas
  - Handles file conversion and cleanup
  - Integrates with `valuePatcher` for precise updates

**`jsonService.js`** - **JSON Data Management**

- **Core Functionality**:
  - JSON file CRUD operations
  - API data fetching and caching
  - Schema inference and data profiling
  - Column configuration management
- **Key Methods**:
  - `fetchAndSaveJson()`, `readJsonFile()`
  - `getDatasetProfile()`, `validateJsonFile()`
  - `createRow()`, `updateRow()`, `deleteRow()`

**`collectionStore.js`** - **Collection-Based Storage**

- **Purpose**: Manages normalized JSON data as collections
- **Key Features**:
  - Optimistic concurrency control
  - File-based locking with `proper-lockfile`
  - CRUD operations with versioning
  - Caching and performance optimization

**`normalizationService.js`** - **Data Normalization**

- **Purpose**: Converts complex JSON into structured collections
- **Key Features**:
  - Schema inference and data profiling
  - Normalization of nested JSON structures
  - Recomposition of collections back to JSON
  - Handles complex data relationships

**`valuePatcher.js`** - **Excel Value Patching**

- **Purpose**: Precise Excel cell updates using ExcelJS
- **Key Features**:
  - Preserves Excel formatting and styles
  - Handles formulas and data types
  - Integrates with `cleanXlsmService`

**`headerUtils.js`** - **Header Management**

- **Purpose**: Manages Excel sheet headers and column detection
- **Key Features**:
  - Dynamic header row detection
  - Column type inference
  - Header validation and correction

**`macroStripper.js`** - **Macro Removal**

- **Purpose**: Safely removes VBA macros from XLSM files
- **Key Features**:
  - Preserves data and formatting
  - Creates clean XLSX copies
  - Handles complex Excel structures

#### **`src/renderer-app/`** - **Frontend Application**

**`src/App.tsx`** - **Main React Component**

- **Purpose**: Central application state management and UI orchestration
- **Key Features**:
  - File management and selection
  - Sheet and collection switching
  - CRUD operation handling
  - Error management and notifications
  - Theme management (light/dark mode)

**`src/components/`** - **UI Components**

**`ExcelGrid.tsx`** - **Excel-like Data Grid**

- **Features**:
  - Sticky headers and column resizing
  - Cell editing and selection
  - Context menus for row operations
  - Sorting and filtering
  - Keyboard navigation
  - Dark mode support

**`CollectionDataViewer.tsx`** - **JSON Collection Interface**

- **Features**:
  - Collection selection and management
  - Tabular data display with ExcelGrid styling
  - CRUD operations for collections
  - Export functionality
  - Context menus and row operations
  - Dark mode support

**`Sidebar.tsx`** - **File Management Sidebar**

- **Features**:
  - File browser with recent files
  - File type indicators (JSON, XLSM)
  - Add JSON file functionality
  - Folder selection and refresh
  - Dark mode support

**`StatusBar.tsx`** - **Application Status Display**

- **Features**:
  - Row/column count display
  - Pagination controls
  - Selection information
  - Ready status indicator
  - Dark mode support

**`ExcelToolbar.tsx`** - **Excel Operations Toolbar**

- **Features**:
  - Add row functionality
  - Filter and sort controls
  - Column management
  - Save operations

**`FormulaBar.tsx`** - **Excel Formula Bar**

- **Features**:
  - Cell value display and editing
  - Formula editing support
  - Keyboard shortcuts

**`FilterModal.tsx`** - **Data Filtering Interface**

- **Features**:
  - Column-based filtering
  - Multiple filter types
  - Filter state management

**`CrudModal.tsx`** - **CRUD Operations Modal**

- **Features**:
  - Add/Edit/Delete operations
  - Form validation
  - Data type handling

**`JsonModal.tsx`** - **JSON Data Viewer**

- **Features**:
  - JSON data display
  - Syntax highlighting
  - Edit capabilities

**`Toast.tsx`** - **Notification System**

- **Features**:
  - Success/error notifications
  - Auto-dismiss functionality
  - Multiple toast support

**`Tooltip.tsx`** - **Tooltip Component**

- **Features**:
  - Contextual help
  - Hover information
  - Custom positioning

---

## 🔄 Data Flow and Operations

### **Excel File Operations:**

1. **File Selection** → `Sidebar` → `App` → `excelService`
2. **Sheet Reading** → `cleanXlsmService` → `excelService` → `SheetJS`
3. **CRUD Operations** → `App` → `cleanXlsmService` → `valuePatcher`/`excelService`
4. **Data Display** → `ExcelGrid` → `App` → `StatusBar`

### **JSON File Operations:**

1. **File Import** → `JsonModal` → `jsonService` → File System
2. **Data Normalization** → `normalizationService` → `collectionStore`
3. **Collection Management** → `CollectionDataViewer` → `collectionStore`
4. **CRUD Operations** → `CollectionDataViewer` → `collectionStore`

### **Configuration Management:**

1. **Config Loading** → `excelService.readConfig()` → `config.json`
2. **Config Updates** → `App` → `excelService.writeConfig()` → `config.json`
3. **Recent Files** → `excelService` → `config.json`

---

## 🛠️ Key Technologies and Dependencies

### **Backend (Node.js/Electron):**

- **Electron**: Desktop application framework
- **SheetJS**: Excel file reading/writing
- **ExcelJS**: Advanced Excel operations and formatting
- **proper-lockfile**: File locking for concurrency control
- **node-fetch**: HTTP requests for API data
- **uuid**: Unique identifier generation

### **Frontend (React/TypeScript):**

- **React 18**: UI framework with hooks
- **TypeScript**: Type safety and development experience
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **@tanstack/react-table**: Table functionality (unused in current implementation)
- **@tippyjs/react**: Tooltip functionality

### **Build Tools:**

- **Vite**: Fast build tool and dev server
- **Electron Builder**: Application packaging
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

---

## 🔧 Configuration System

### **`config.json` Structure:**

```json
{
  "folderPath": "/path/to/workbook",
  "pkName": "App ID",
  "cacheTtlMs": 2000,
  "pageSizeDefault": 25,
  "maxPageSize": 200,
  "ignoreSheets": ["Tags", "Step_Template"],
  "headerRowConfig": {
    /* per-file header configurations */
  },
  "xlsmConversion": {
    /* XLSM handling settings */
  },
  "jsonSettings": {
    /* JSON processing settings */
  }
}
```

---

## 🎨 UI/UX Features

### **Excel Interface:**

- **Excel-like Grid**: Sticky headers, column resizing, cell editing
- **Formula Bar**: Cell value display and editing
- **Context Menus**: Right-click operations for rows
- **Keyboard Navigation**: Arrow keys, Enter, Escape
- **Sorting and Filtering**: Column-based operations

### **JSON Interface:**

- **Collection Tabs**: Switch between normalized collections
- **Tabular Display**: ExcelGrid-inspired styling
- **CRUD Operations**: Add, edit, delete rows
- **Export Functionality**: Export collections back to JSON

### **Theme Support:**

- **Light/Dark Mode**: Comprehensive theme support
- **Consistent Styling**: Tailwind CSS with custom classes
- **Responsive Design**: Adaptive layouts

---

## 🔒 Security and Performance

### **Security:**

- **Context Isolation**: Secure IPC communication
- **File Locking**: Prevents data corruption
- **Input Validation**: Sanitized user inputs
- **Error Handling**: Graceful error recovery

### **Performance:**

- **Caching**: Multi-level caching system
- **Lazy Loading**: On-demand data loading
- **Pagination**: Large dataset handling
- **Optimistic Updates**: Immediate UI feedback

---

## 📊 Data Processing Pipeline

### **Excel Processing:**

1. **File Detection** → XLSM conversion if needed
2. **Sheet Reading** → Header detection and validation
3. **Data Normalization** → Row/column structure
4. **CRUD Operations** → Value patching with formatting preservation

### **JSON Processing:**

1. **File Import** → API fetching or file reading
2. **Schema Inference** → Data type detection and profiling
3. **Normalization** → Collection-based structure
4. **CRUD Operations** → Collection store management

---

## 🚀 Key Features Summary

### **Excel Management:**

- ✅ Full CRUD operations on Excel files
- ✅ XLSM macro handling and conversion
- ✅ Formatting preservation
- ✅ Multi-sheet support
- ✅ Header row configuration
- ✅ Sorting and filtering

### **JSON Management:**

- ✅ API data import
- ✅ Schema inference and profiling
- ✅ Collection-based storage
- ✅ CRUD operations
- ✅ Export functionality
- ✅ Data validation

### **User Experience:**

- ✅ Excel-like interface
- ✅ Dark/light theme support
- ✅ Context menus and keyboard shortcuts
- ✅ Real-time updates and notifications
- ✅ Error handling and recovery
- ✅ Responsive design

---

## 🔧 Development Setup

### **Prerequisites:**

- Node.js 18+
- npm or yarn
- Git

### **Installation:**

```bash
# Clone the repository
git clone <repository-url>
cd ExcelDatabaseElectron

# Install dependencies
npm install

# Start development server
npm run start:dev
```

### **Available Scripts:**

- `npm run start:dev`: Start development server with hot reload
- `npm run renderer:build`: Build renderer process
- `npm run start:prod`: Start production build
- `npm run build`: Build for distribution
- `npm run cleanup`: Clean up build artifacts

---

## 📝 API Reference

### **Main Process IPC Handlers:**

#### **Configuration:**

- `config:get` - Get application configuration
- `config:set` - Update configuration
- `config:getValue` - Get specific config value
- `config:addRecentWorkbook` - Add file to recent list
- `config:getRecentWorkbooks` - Get recent files list

#### **File Operations:**

- `folder:pick` - Select folder dialog
- `folder:scan` - Scan folder for files
- `folder:refresh` - Refresh file list

#### **Excel Operations:**

- `workbook:meta` - Get workbook metadata
- `workbook:export` - Export workbook
- `workbook:save` - Save workbook
- `sheet:read` - Read sheet data
- `sheet:create` - Create new row
- `sheet:update` - Update row
- `sheet:delete` - Delete row

#### **JSON Operations:**

- `json:fetch` - Fetch JSON from API
- `json:read` - Read JSON file
- `json:meta` - Get JSON metadata
- `json:create` - Create JSON row
- `json:update` - Update JSON row
- `json:delete` - Delete JSON row
- `json:export` - Export JSON data

#### **Collection Operations:**

- `collection:list` - List collection rows
- `collection:create` - Create collection row
- `collection:update` - Update collection row
- `collection:delete` - Delete collection row
- `collection:meta` - Get collection metadata

#### **Normalization:**

- `normalize:json` - Normalize JSON data
- `normalize:recompose` - Recompose collections to JSON
- `normalize:hasCollections` - Check if collections exist

---

## 🐛 Troubleshooting

### **Common Issues:**

1. **XLSM Conversion Errors:**

   - Check if Python is installed for macro stripping
   - Verify file permissions
   - Check logs for specific error messages

2. **JSON Import Failures:**

   - Validate JSON structure
   - Check API endpoint accessibility
   - Verify file size limits

3. **Performance Issues:**

   - Check cache settings in config
   - Monitor memory usage
   - Adjust page size settings

4. **UI Rendering Problems:**
   - Clear browser cache
   - Restart development server
   - Check console for errors

---

## 🤝 Contributing

### **Code Style:**

- Use TypeScript for type safety
- Follow React hooks patterns
- Use Tailwind CSS for styling
- Maintain consistent error handling

### **Testing:**

- Test both Excel and JSON operations
- Verify dark mode functionality
- Test CRUD operations thoroughly
- Check error handling scenarios

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- **SheetJS** for Excel file handling
- **ExcelJS** for advanced Excel operations
- **Electron** for desktop application framework
- **React** for UI framework
- **Tailwind CSS** for styling system

---

_This documentation is maintained alongside the codebase and should be updated with any significant changes._
