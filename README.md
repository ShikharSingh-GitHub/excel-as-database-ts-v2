# Excel Database Electron

A powerful Electron desktop application that treats Excel workbooks (.xlsx/.xlsm) as databases, providing a modern CRUD interface with advanced features like sorting, filtering, and real-time editing.

## 🚀 **Features**

### Core Functionality

- **Excel-as-Database**: Treat Excel workbooks as relational databases
- **Multi-Format Support**: Full support for `.xlsx` and `.xlsm` files
- **XLSM Handling**: Intelligent macro stripping with formatting preservation
- **Real-time Editing**: Inline cell editing with instant updates
- **CRUD Operations**: Create, Read, Update, Delete with version control

### Advanced Features

- **Smart Sorting**: Multi-column sorting with state preservation
- **Global Filtering**: Real-time search across all data
- **Column Filtering**: Advanced filtering by specific columns
- **Pagination**: Configurable page sizes (25-200 rows)
- **Export Functionality**: Create read-only copies of workbooks
- **Sheet Management**: Configurable sheet visibility and read-only modes

### File Safety & Performance

- **Atomic Writes**: Temporary file → rename pattern prevents corruption
- **File Locking**: Proper-lockfile implementation for concurrent access
- **Intelligent Caching**: 2-second TTL with automatic invalidation
- **Formatting Preservation**: Maintains Excel formatting, styles, and formulas

## 📋 **Requirements**

- **Node.js**: 20+ (LTS recommended)
- **Electron**: 31+
- **Operating System**: macOS 12+ or Windows 10+
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 1GB free space for application + Excel files

## 🛠 **Installation**

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ExcelDatabaseElectron

# Install dependencies
npm install

# Start the application
npm run start:dev
```

### Development Mode

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run start:dev

# Build for production
npm run build

# Run tests
npm test
```

### Production Build

```bash
# Build the application
npm run build

# Start production version
npm run start:prod
```

## 🎯 **Usage**

### First Launch

1. **Select Folder**: Click "Choose Folder" to select a directory containing Excel files
2. **Browse Files**: All `.xlsx` and `.xlsm` files will appear in the left sidebar
3. **Open Workbook**: Click any file to load it as the active workbook
4. **Navigate Sheets**: Use the sheet tabs to switch between different sheets

### Working with Data

- **View Data**: Data is displayed in an editable grid with pagination
- **Edit Cells**: Double-click any cell to edit inline
- **Add Rows**: Use the "Add Row" button to create new entries
- **Delete Rows**: Select a row and use "Delete Row" button
- **Sort Data**: Click column headers to sort ascending/descending
- **Filter Data**: Use the search bar for global filtering

### Advanced Operations

- **Export**: Create read-only copies of workbooks
- **Refresh**: Manually refresh file list and data
- **Context Menu**: Right-click for additional options
- **Keyboard Shortcuts**: Ctrl+S (Save), Ctrl+C (Copy), Ctrl+V (Paste)

## ⚙️ **Configuration**

The application uses `config.json` for configuration. Key settings:

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
  }
}
```

### Configuration Options

| Option               | Type   | Default | Description                              |
| -------------------- | ------ | ------- | ---------------------------------------- |
| `folderPath`         | string | null    | Default folder for Excel files           |
| `pkName`             | string | "id"    | Primary key column name                  |
| `cacheTtlMs`         | number | 2000    | Cache time-to-live in milliseconds       |
| `pageSizeDefault`    | number | 25      | Default rows per page                    |
| `maxPageSize`        | number | 200     | Maximum rows per page                    |
| `autoRefreshSeconds` | number | 0       | Auto-refresh interval (0 = disabled)     |
| `readOnlySheets`     | array  | []      | Sheets that are read-only                |
| `ignoreSheets`       | array  | []      | Sheets to hide from UI                   |
| `headerRowConfig`    | object | {}      | Custom header row positions per workbook |

## 🏗 **Architecture**

### Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Electron + Node.js
- **Excel Processing**: SheetJS (XLSX) + ExcelJS
- **File Operations**: proper-lockfile for atomic writes

### Key Components

#### Frontend (Renderer)

- **App.tsx**: Main application component with state management
- **ExcelGrid.tsx**: Editable data grid with sorting/filtering
- **ExcelToolbar.tsx**: Toolbar with CRUD operations
- **Sidebar.tsx**: File browser and navigation
- **SheetTabs.tsx**: Sheet navigation tabs
- **CrudModal.tsx**: Add/Edit forms with validation

#### Backend (Main Process)

- **excelService.js**: Core Excel file operations (XLSX)
- **cleanXlsmService.js**: XLSM handling with macro stripping
- **macroStripper.js**: Converts XLSM to XLSX safely
- **valuePatcher.js**: Patches cell values without losing formatting

### Data Flow

1. **File Selection** → Sidebar loads Excel files
2. **Workbook Loading** → Main process reads workbook metadata
3. **Sheet Loading** → Sheet data loaded with pagination
4. **User Operations** → CRUD operations via IPC
5. **File Updates** → Atomic writes with caching

## 🔧 **Development**

### Project Structure

```
ExcelDatabaseElectron/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # IPC bridge
│   ├── electron/               # Backend services
│   │   ├── excelService.js     # XLSX operations
│   │   ├── cleanXlsmService.js # XLSM operations
│   │   ├── macroStripper.js    # Macro stripping
│   │   └── valuePatcher.js     # Value patching
│   └── renderer-app/           # React frontend
│       ├── src/
│       │   ├── App.tsx         # Main app component
│       │   └── components/     # UI components
│       └── package.json
├── scripts/                    # Utility scripts
├── config.json                 # Application config
└── package.json
```

### Key Features Implementation

#### XLSM Support

- **Macro Stripping**: Converts XLSM to XLSX using ExcelJS
- **Formatting Preservation**: Maintains styles, colors, and formulas
- **Sidecar Files**: Creates `.working.xlsx` files for operations
- **Value Patching**: Updates only cell values, preserving formatting

#### Row Number CRUD

- **Reliable Operations**: Uses visible row numbers instead of primary keys
- **Sort State Preservation**: Maintains sort order across operations
- **Empty Row Filtering**: Automatically removes completely empty rows
- **Cache Invalidation**: Ensures UI updates after operations

#### File Safety

- **Atomic Writes**: Temporary file creation before replacement
- **File Locking**: Prevents concurrent access conflicts
- **Error Recovery**: Graceful handling of file system errors
- **Backup Creation**: Automatic backup before major operations

## 🧪 **Testing**

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
```

### Test Coverage

- **Unit Tests**: Component and utility function testing
- **Integration Tests**: File operations and CRUD testing
- **E2E Tests**: Full application workflow testing

## 🚨 **Troubleshooting**

### Common Issues

#### Application Won't Start

- **Check Node.js version**: Ensure Node.js 20+ is installed
- **Clear cache**: Delete `node_modules` and reinstall
- **Check permissions**: Ensure write access to config directory

#### Excel Files Not Loading

- **Check file format**: Ensure files are `.xlsx` or `.xlsm`
- **Check file permissions**: Ensure read access to Excel files
- **Check file corruption**: Try opening files in Excel first

#### Performance Issues

- **Reduce page size**: Lower `pageSizeDefault` in config
- **Clear cache**: Restart application to clear memory cache
- **Check file size**: Large files (>50MB) may be slow

#### XLSM Issues

- **Macro stripping failed**: Check if ExcelJS is properly installed
- **Formatting lost**: Ensure `preserveFormatting: true` in config
- **Working copy issues**: Delete `.working.xlsx` files and restart

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=true npm run start:dev
```

## 📝 **Changelog**

### Version 1.0.0 (Current)

- ✅ Complete CRUD operations with row number approach
- ✅ XLSM support with macro stripping
- ✅ Advanced sorting and filtering
- ✅ Export functionality
- ✅ Configurable sheet visibility
- ✅ Atomic file operations
- ✅ Comprehensive error handling

### Planned Features

- 🔄 Auto-refresh with file watchers
- 🔄 Advanced type hints and validation
- 🔄 Bulk import/export operations
- 🔄 Multi-sheet relationships
- 🔄 Advanced audit logging

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Ensure backward compatibility

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **SheetJS**: Excel file processing library
- **ExcelJS**: Advanced Excel operations
- **Electron**: Cross-platform desktop framework
- **React**: User interface library
- **Tailwind CSS**: Utility-first CSS framework

---

**Made with ❤️ for Excel power users**
