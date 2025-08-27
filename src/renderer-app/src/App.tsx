import React, { useCallback, useEffect, useRef, useState } from "react";
import ContextMenu from "./components/ContextMenu";
import CrudModal from "./components/CrudModal";
import ExcelGrid from "./components/ExcelGrid";
import ExcelToolbar from "./components/ExcelToolbar";
import FormulaBar from "./components/FormulaBar";
import SheetTabs from "./components/SheetTabs";
import Sidebar, { Workbook } from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Toast from "./components/Toast";
import Tooltip from "./components/Tooltip";
import "./index.css";

type FileEntry = { name: string; path: string; size: number; mtimeMs: number };

export default function App() {
  const [dark, setDark] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  const [sheetRows, setSheetRows] = useState<any>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 25,
    headers: [],
  });
  const [filterText, setFilterText] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {}
  );
  const [sortState, setSortState] = useState<{
    key: string | null;
    dir: "asc" | "desc";
  } | null>(null);

  const [modal, setModal] = useState<any>({
    open: false,
    mode: null,
    data: null,
    errors: null,
    conflict: null,
  });
  const [toast, setToast] = useState<string | null>(null);
  
  // Excel-like UI state
  const [selectedCell, setSelectedCell] = useState<{row: number; col: number} | null>(null);
  const [contextMenu, setContextMenu] = useState<{x: number; y: number} | null>(null);

  // Load config and initial folder scan
  useEffect(() => {
    (async () => {
      try {
        const cfg = await (window as any).api.invoke("config:get");
        setConfig(cfg || {});
        const folder = cfg && cfg.folderPath;
        if (!folder) {
          const p = await (window as any).api.invoke("folder:pick");
          if (p) {
            await (window as any).api.invoke("config:set", { folderPath: p });
            setConfig((prev: any) => ({ ...(prev || {}), folderPath: p }));
            const res = await (window as any).api.invoke("folder:scan", p);
            if (!res.error) setFiles(res.files || []);
          } else {
            setToast("No folder selected");
          }
        } else {
          const res = await (window as any).api.invoke("folder:scan", folder);
          if (!res.error) setFiles(res.files || []);
        }
      } catch (err) {
        const e = err as any;
        console.error(e);
        setToast("Startup error: " + (e && e.message ? e.message : String(e)));
      }
    })();
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      const folder = (config && config.folderPath) || null;
      if (!folder) return;
      const res = await (window as any).api.invoke("folder:scan", folder);
      if (!res.error) setFiles(res.files || []);
    } catch (e) {
      console.error(e);
    }
  }, [config]);

  const pickFolder = useCallback(async () => {
    try {
      const p = await (window as any).api.invoke("folder:pick");
      if (p) {
        await (window as any).api.invoke("config:set", { folderPath: p });
        setConfig((prev: any) => ({ ...(prev || {}), folderPath: p }));
        const res = await (window as any).api.invoke("folder:scan", p);
        if (!res.error) setFiles(res.files || []);
      } else {
        setToast("No folder selected");
      }
    } catch (e) {
      console.error(e);
      setToast("Failed to pick folder");
    }
  }, []);

  const openWorkbook = useCallback(
    async (file: FileEntry) => {
      try {
        setActiveFile(file.path);
        const m = await (window as any).api.invoke("workbook:meta", file.path);
        if (m && !m.error) {
          setMeta(m);
          setActiveSheet(null);
          setSheetRows({
            rows: [],
            total: 0,
            page: 1,
            pageSize: config?.pageSizeDefault || 25,
            headers: [],
          });
          // load persisted sort state for this workbook
          try {
            const sort = await (window as any).api.invoke(
              "sort:get",
              file.path
            );
            // store into state if needed; for now we just set columnFilters to empty
            // DataGrid will reflect sort via server-side ordering when implemented
            // Optionally trigger load of first sheet later when selected
            // We can store in config state if needed
            setTimeout(() => {}, 0);
          } catch (e) {}
        } else {
          setToast(m.message || "Failed to load workbook metadata");
          setActiveFile(null);
        }
      } catch (err) {
        const e = err as any;
        setToast(
          "Error opening workbook: " + (e && e.message ? e.message : String(e))
        );
        setActiveFile(null);
      }
    },
    [config]
  );

  const loadSheet = useCallback(
    async (sheetName: string, page = 1) => {
      if (!activeFile || !sheetName) return;
      try {
        const res = await (window as any).api.invoke(
          "sheet:read",
          activeFile,
          sheetName,
          {
            page,
            pageSize:
              sheetRows.pageSize || (config && config.pageSizeDefault) || 25,
            filter: filterText,
            columnFilters: columnFilters,
            sort: sortState || null,
          }
        );
        if (res && !res.error) {
          setSheetRows(res);
          setActiveSheet(sheetName);
        } else {
          setToast(res.message || "Failed to load sheet");
        }
      } catch (err) {
        const e = err as any;
        setToast(
          "Error loading sheet: " + (e && e.message ? e.message : String(e))
        );
      }
    },
    [activeFile, filterText, sheetRows.pageSize, config]
  );

  // CRUD operations
  const openAddModal = () =>
    setModal({ open: true, mode: "add", data: {}, errors: {} });

  const submitAdd = async (data: any) => {
    if (!activeFile || !activeSheet) return setToast("No active sheet");
    const res = await (window as any).api.invoke(
      "sheet:create",
      activeFile,
      activeSheet,
      data
    );
    if (res && res.error) {
      setToast(res.message || "Add failed");
      return;
    }
    setModal({ open: false, mode: null, data: null });
    await loadSheet(activeSheet, 1);
    setToast("Row added");
  };

  const openEditModal = (row: any) =>
    setModal({
      open: true,
      mode: "edit",
      data: JSON.parse(JSON.stringify(row)),
      errors: {},
    });

  const submitEdit = async (row: any) => {
    if (!activeFile || !activeSheet) return setToast("No active sheet");
    const pkName = (config && config.pkName) || "id";
    const pkValue = row[pkName];
    const expected = row["_version"];
    const updates = Object.assign({}, row);
    delete updates[pkName];
    delete updates["_version"];
    const res = await (window as any).api.invoke(
      "sheet:update",
      activeFile,
      activeSheet,
      pkValue,
      updates,
      expected
    );
    if (res && res.error) {
      if (res.error === "version-conflict") {
        setModal({
          open: true,
          mode: "conflict",
          data: row,
          conflict: res.current,
        });
        return;
      }
      setToast(res.message || "Update failed");
      return;
    }
    setModal({ open: false, mode: null, data: null });
    await loadSheet(activeSheet, sheetRows.page);
    setToast("Row updated");
  };

  const deleteRow = async (row: any) => {
    if (!activeFile || !activeSheet) return setToast("No active sheet");
    if (!confirm("Delete this row?")) return;
    const pkName = (config && config.pkName) || "id";
    const pkValue = row[pkName];
    const expected = row["_version"];
    const res = await (window as any).api.invoke(
      "sheet:delete",
      activeFile,
      activeSheet,
      pkValue,
      expected
    );
    if (res && res.error) {
      if (res.error === "version-conflict") {
        setToast("Version conflict, reload sheet");
        await loadSheet(activeSheet, 1);
        return;
      }
      setToast(res.message || "Delete failed");
      return;
    }
    await loadSheet(activeSheet, sheetRows.page);
    setToast("Row deleted");
  };

  // Excel-like handlers
  const handleCellEdit = async (rowIndex: number, colKey: string, value: any) => {
    try {
      if (!activeFile || !activeSheet) {
        setToast("No active sheet");
        return;
      }
      const row = sheetRows.rows[rowIndex];
      if (!row) {
        setToast("Row not found");
        return;
      }
      
      const pkName = (config && config.pkName) || "id";
      const pkValue = row[pkName];
      const expected = row["_version"];
      const updates = { [colKey]: value };
      
      const res = await (window as any).api.invoke(
        "sheet:update",
        activeFile,
        activeSheet,
        pkValue,
        updates,
        expected
      );
      
      if (res && res.error) {
        if (res.error === "version-conflict") {
          setToast("Version conflict, please reload");
          await loadSheet(activeSheet, sheetRows.page);
          return;
        }
        setToast(res.message || "Update failed");
        return;
      }
      
      // Refresh the current page
      await loadSheet(activeSheet, sheetRows.page);
      setToast("Cell updated successfully");
    } catch (error) {
      console.error('Error updating cell:', error);
      setToast("Failed to update cell");
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  const getCurrentCellValue = () => {
    if (!selectedCell || !sheetRows.rows[selectedCell.row]) return "";
    const row = sheetRows.rows[selectedCell.row];
    const header = sheetRows.headers[selectedCell.col];
    return row[header] || "";
  };

  const handleFormulaBarChange = (value: string) => {
    if (!selectedCell) return;
    const header = sheetRows.headers[selectedCell.col];
    handleCellEdit(selectedCell.row, header, value);
  };

  useEffect(() => {
    if (activeSheet) loadSheet(activeSheet, sheetRows.page);
  }, [activeSheet, sheetRows.page, filterText, columnFilters, sortState]);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="flex h-screen flex-col bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900 dark:from-gray-900 dark:to-gray-800 dark:text-gray-100 relative">
        <header className="flex flex-col">
          {/* Title Bar */}
          <div className="h-12 px-4 border-b border-gray-200/50 flex items-center gap-3 bg-white/80 backdrop-blur-sm shadow-sm z-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">📊</span>
              </div>
              <div className="flex-1 font-semibold text-gray-800 text-lg">Excel Database</div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip content="Choose a different folder">
                <button
                  onClick={async () => {
                    try {
                      const result = await (window as any).api.invoke('folder:pick');
                      if (result) {
                        setConfig((prev: any) => ({ ...prev, folderPath: result }));
                        refreshFiles();
                      }
                    } catch (error) {
                      setToast('Failed to pick folder');
                    }
                  }}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  📁
                </button>
              </Tooltip>
              <Tooltip content={dark ? "Switch to light mode" : "Switch to dark mode"}>
                <button
                  onClick={() => setDark(!dark)}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  {dark ? "☀️" : "🌙"}
                </button>
              </Tooltip>
              <Tooltip content="Refresh all files">
                <button
                  onClick={refreshFiles}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  🔄
                </button>
              </Tooltip>
            </div>
          </div>
          
          {/* Excel Toolbar */}
          <div className="z-0">
            <ExcelToolbar
              onSave={async () => {
                try {
                  if (activeFile && activeSheet) {
                    await (window as any).api.invoke('workbook:save', activeFile);
                    setToast("Saved successfully");
                  } else {
                    setToast("No file to save");
                  }
                } catch (error) {
                  setToast("Save failed");
                }
              }}
              onUndo={() => setToast("Undo not implemented yet")}
              onRedo={() => setToast("Redo not implemented yet")}
              onCopy={() => {
                if (selectedCell) {
                  const cellValue = sheetRows.rows[selectedCell.row]?.[sheetRows.headers[selectedCell.col]] || "";
                  navigator.clipboard.writeText(String(cellValue));
                  setToast("Copied to clipboard");
                } else {
                  setToast("No cell selected");
                }
              }}
              onPaste={async () => {
                if (selectedCell) {
                  try {
                    const text = await navigator.clipboard.readText();
                    const header = sheetRows.headers[selectedCell.col];
                    await handleCellEdit(selectedCell.row, header, text);
                    setToast("Pasted from clipboard");
                  } catch (error) {
                    setToast("Paste failed");
                  }
                } else {
                  setToast("No cell selected");
                }
              }}
              onCut={() => {
                if (selectedCell) {
                  const cellValue = sheetRows.rows[selectedCell.row]?.[sheetRows.headers[selectedCell.col]] || "";
                  navigator.clipboard.writeText(String(cellValue));
                  const header = sheetRows.headers[selectedCell.col];
                  handleCellEdit(selectedCell.row, header, "");
                  setToast("Cut to clipboard");
                } else {
                  setToast("No cell selected");
                }
              }}
              onAddRow={() => setModal({ open: true, mode: "add", data: {}, errors: {}, conflict: null })}
              onDeleteRow={() => {
                if (selectedCell && selectedCell.row >= 0) {
                  const confirmDelete = window.confirm("Are you sure you want to delete this row?");
                  if (confirmDelete) {
                    deleteRow(sheetRows.rows[selectedCell.row]);
                  }
                } else {
                  setToast("No row selected");
                }
              }}
              onSort={(column) => {
                if (selectedCell) {
                  const newDir = sortState?.key === column && sortState.dir === 'asc' ? 'desc' : 'asc';
                  setSortState({ key: column, dir: newDir });
                  setToast(`Sorted by ${column} ${newDir}ending`);
                } else {
                  setToast("Select a column to sort");
                }
              }}
              onFilter={() => {
                const filterValue = prompt("Enter filter value:");
                if (filterValue) {
                  setFilterText(filterValue);
                  setToast(`Filtered by: ${filterValue}`);
                }
              }}
              readOnly={false}
            />
          </div>

          {/* Formula Bar */}
          <div className="z-0">
            <FormulaBar
              selectedCell={selectedCell}
              cellValue={selectedCell ? sheetRows.rows[selectedCell.row]?.[sheetRows.headers[selectedCell.col]] || "" : ""}
              onCellValueChange={handleFormulaBarChange}
              headers={sheetRows.headers}
            />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            files={files}
            onOpen={(f: any) => openWorkbook(f)}
            onRefresh={refreshFiles}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            {meta && (
              <SheetTabs
                sheets={meta.sheets || []}
                active={activeSheet}
                onSelect={(s: string) => loadSheet(s, 1)}
              />
            )}

            <main className="flex-1 flex flex-col overflow-hidden">
              {/* Quick Filter Bar */}
              <div className="h-10 px-4 border-b border-gray-200/50 flex items-center gap-3 bg-white/60 backdrop-blur-sm">
                <div className="relative">
                  <Tooltip content="Search and filter data across all columns">
                    <input
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="🔍 Search data..."
                      className="pl-3 pr-10 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm transition-all"
                    />
                  </Tooltip>
                </div>
                <div className="ml-auto text-xs text-gray-500 truncate bg-gray-100 px-2 py-1 rounded">
                  {meta ? meta.path.split('/').pop() : "No file selected"}
                </div>
              </div>

              {/* Excel Grid */}
              {activeSheet && (
                <div 
                  className="flex-1 overflow-hidden"
                  onContextMenu={handleContextMenu}
                >
                  <ExcelGrid
                    headers={sheetRows.headers || []}
                    rows={sheetRows.rows || []}
                    onCellEdit={handleCellEdit}
                    onRowAdd={openAddModal}
                    onRowDelete={(rowIndex) => {
                      if (sheetRows.rows[rowIndex]) {
                        deleteRow(sheetRows.rows[rowIndex]);
                      }
                    }}
                    readOnly={((config && config.readOnlySheets) || []).includes(
                      activeSheet || ""
                    )}
                    selectedCell={selectedCell}
                    onCellSelect={setSelectedCell}
                    sortState={sortState ? { column: sortState.key || '', direction: sortState.dir } : undefined}
                    onSort={(column) => {
                      const newDir = sortState?.key === column && sortState.dir === 'asc' ? 'desc' : 'asc';
                      setSortState({ key: column, dir: newDir });
                    }}
                  />
                </div>
              )}
            </main>
          </div>
        </div>

        <CrudModal
          open={modal.open}
          mode={modal.mode}
          conflict={modal.conflict}
          title={
            modal.mode === "add"
              ? "Add Row"
              : modal.mode === "edit"
              ? "Edit Row"
              : "Conflict"
          }
          headers={sheetRows.headers || []}
          data={modal.data || {}}
          errors={modal.errors || {}}
          onClose={() => setModal({ open: false, mode: null, data: null })}
          onSubmit={() => {
            if (modal.mode === "add") submitAdd(modal.data);
            else if (modal.mode === "edit") submitEdit(modal.data);
          }}
          onChange={(header: string, value: any) =>
            setModal((prev: any) => ({
              ...prev,
              data: { ...(prev.data || {}), [header]: value },
            }))
          }
          onResolve={async (action: string) => {
            if (action === "reload") {
              if (activeSheet) await loadSheet(activeSheet, 1);
              setModal({ open: false, mode: null, data: null });
            } else if (action === "overwrite") {
              // attempt to apply user's data on top of current by using current _version
              try {
                const pkName = (config && config.pkName) || "id";
                const row = modal.data || {};
                const pkValue = row[pkName];
                const updates = { ...row };
                delete updates[pkName];
                delete updates["_version"];
                const expected = modal.conflict && modal.conflict["_version"];
                const res = await (window as any).api.invoke(
                  "sheet:update",
                  activeFile,
                  activeSheet,
                  pkValue,
                  updates,
                  expected
                );
                if (res && res.error) {
                  setToast(res.message || "Overwrite failed");
                } else {
                  setToast("Overwrite succeeded");
                }
              } catch (err) {
                const e = err as any;
                setToast(
                  "Error overwriting: " +
                    (e && e.message ? e.message : String(e))
                );
              }
              if (activeSheet) await loadSheet(activeSheet, sheetRows.page);
              setModal({ open: false, mode: null, data: null });
            }
          }}
        />

        {/* Status Bar */}
        <div className="z-0">
          <StatusBar
            selectedCell={selectedCell}
            totalRows={sheetRows.total}
            totalCols={sheetRows.headers.length}
            readOnly={false}
            activeSheet={activeSheet || undefined}
          />
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onCopy={() => setToast("Copied to clipboard")}
            onPaste={() => setToast("Pasted from clipboard")}
            onInsertRow={openAddModal}
            onDeleteRow={() => {
              if (selectedCell && sheetRows.rows[selectedCell.row]) {
                deleteRow(sheetRows.rows[selectedCell.row]);
              }
            }}
            onSort={(direction) => {
              if (selectedCell) {
                const header = sheetRows.headers[selectedCell.col];
                setSortState({ key: header, dir: direction });
                loadSheet(activeSheet!, 1);
              }
            }}
            readOnly={((config && config.readOnlySheets) || []).includes(activeSheet || "")}
          />
        )}

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
