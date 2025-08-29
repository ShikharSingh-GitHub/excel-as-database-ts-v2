import React, { useCallback, useEffect, useRef, useState } from "react";
import ContextMenu from "./components/ContextMenu";
import CrudModal from "./components/CrudModal";
import ExcelGrid from "./components/ExcelGrid";
import ExcelToolbar from "./components/ExcelToolbar";
import FilterModal from "./components/FilterModal";
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
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterModalHeader, setFilterModalHeader] = useState<string | null>(
    null
  );
  const [filterModalInitial, setFilterModalInitial] = useState<string>("");
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
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex?: number;
    header?: string;
  } | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, boolean>>(
    {}
  );

  // Load config and initial folder scan
  useEffect(() => {
    (async () => {
      try {
        const cfg = await (window as any).api.invoke("config:get");
        setConfig(cfg || {});
        // Initialize theme from config.ui.theme (auto/light/dark)
        try {
          const theme = cfg && cfg.ui && cfg.ui.theme ? cfg.ui.theme : "auto";
          if (theme === "dark") {
            setDark(true);
            document.documentElement.classList.add("dark");
          } else if (theme === "light") {
            setDark(false);
            document.documentElement.classList.remove("dark");
          } else {
            // auto: follow system preference
            const prefersDark =
              typeof window !== "undefined" &&
              window.matchMedia &&
              window.matchMedia("(prefers-color-scheme: dark)").matches;
            setDark(prefersDark);
            document.documentElement.classList.toggle("dark", prefersDark);
          }
        } catch (e) {
          // ignore theme initialization errors
        }
        const folder = cfg && cfg.folderPath;
        if (!folder) {
          const p = await (window as any).api.invoke("folder:pick");
          if (p) {
            await (window as any).api.invoke("config:set", { folderPath: p });
            setConfig((prev: any) => ({ ...(prev || {}), folderPath: p }));
            const res = await (window as any).api.invoke("folder:scan", p);
            if (!res.error) setFiles(res.files || []);
          } else {
            setToast("❌ No folder selected");
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

  // When dark toggles, update document class and persist preference
  useEffect(() => {
    try {
      document.documentElement.classList.toggle("dark", Boolean(dark));
      // persist into config.ui.theme
      const nextTheme = dark ? "dark" : "light";
      if (config) {
        const newUi = Object.assign({}, config.ui || {}, { theme: nextTheme });
        (window as any).api.invoke("config:set", { ui: newUi }).catch(() => {});
        setConfig((prev: any) => ({ ...(prev || {}), ui: newUi }));
      }
    } catch (e) {}
  }, [dark]);

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
        setToast("❌ No folder selected");
      }
    } catch (e) {
      console.error(e);
      setToast("❌ Failed to pick folder");
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
          setToast("❌ " + (m.message || "Failed to load workbook metadata"));
          setActiveFile(null);
        }
      } catch (err) {
        const e = err as any;
        setToast(
          "❌ Error opening workbook: " +
            (e && e.message ? e.message : String(e))
        );
        setActiveFile(null);
      }
    },
    [config]
  );

  const loadSheet = useCallback(
    async (sheetName: string, page = 1, sortArg?: any) => {
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
            sort: sortArg ?? sortState ?? null,
          }
        );
        if (res && !res.error) {
          setSheetRows(res);
          setActiveSheet(sheetName);
        } else {
          // If sheet is unavailable (no headers), refresh workbook metadata and retry once
          const lowerMessage =
            (res && res.message && String(res.message).toLowerCase()) || "";
          if (
            (res && res.error === "sheet-unavailable") ||
            lowerMessage.includes("no headers")
          ) {
            try {
              if (activeFile) {
                const refreshed = await (window as any).api.invoke(
                  "workbook:meta",
                  activeFile
                );
                if (refreshed && !refreshed.error) {
                  setMeta(refreshed);
                }

                // retry reading sheet once
                const retry = await (window as any).api.invoke(
                  "sheet:read",
                  activeFile,
                  sheetName,
                  {
                    page,
                    pageSize:
                      sheetRows.pageSize ||
                      (config && config.pageSizeDefault) ||
                      25,
                    filter: filterText,
                    columnFilters: columnFilters,
                    sort: sortArg ?? sortState ?? null,
                  }
                );
                if (retry && !retry.error) {
                  setSheetRows(retry);
                  setActiveSheet(sheetName);
                  return;
                }
              }
            } catch (e) {
              // ignore and fall through to toast
            }
          }
          setToast("❌ " + (res.message || "Failed to load sheet"));
        }
      } catch (err) {
        const e = err as any;
        setToast(
          "❌ Error loading sheet: " + (e && e.message ? e.message : String(e))
        );
      }
    },
    [
      activeFile,
      filterText,
      sheetRows.pageSize,
      config,
      columnFilters,
      sortState,
    ]
  );

  // Handle request from grid to open context menu for a specific column
  const handleGridContextRequest = useCallback(
    (
      x: number,
      y: number,
      opts?: { rowIndex?: number; colIndex?: number; header?: string }
    ) => {
      // If a column header was right-clicked, show the contextual header menu
      if (opts && opts.header) {
        setContextMenu({ x, y, header: opts.header });
      } else if (opts && typeof opts.rowIndex === "number") {
        // fallback to show the existing context menu for row operations
        setContextMenu({ x, y, rowIndex: opts.rowIndex });
      }
    },
    []
  );

  // CRUD operations
  const openAddModal = (position?: number) => {
    const pkName = (config && config.pkName) || "id";

    // Generate auto-incrementing ID based on position
    let newId = 1;
    if (sheetRows && sheetRows.rows && sheetRows.rows.length > 0) {
      if (position !== undefined && position < sheetRows.rows.length) {
        // Insert between rows
        const prevRow = sheetRows.rows[position - 1];
        const nextRow = sheetRows.rows[position];
        if (prevRow && nextRow) {
          newId = Math.max(
            (prevRow[pkName] || 0) + 1,
            (nextRow[pkName] || 0) - 1
          );
        } else if (prevRow) {
          newId = (prevRow[pkName] || 0) + 1;
        } else if (nextRow) {
          newId = (nextRow[pkName] || 0) - 1;
        }
      } else {
        // Add at the end
        const lastRow = sheetRows.rows[sheetRows.rows.length - 1];
        newId = lastRow ? (lastRow[pkName] || 0) + 1 : 1;
      }
    } else {
      // Add at the end when no rows
      const lastRow =
        sheetRows &&
        sheetRows.rows &&
        sheetRows.rows[sheetRows.rows.length - 1];
      newId = lastRow ? (lastRow[pkName] || 0) + 1 : 1;
    }

    const initialData = { [pkName]: newId };

    setModal({
      open: true,
      mode: "add",
      data: initialData,
      errors: {},
      conflict: null,
    });
  };

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
    setToast("✅ Row updated");
  };

  const submitAdd = async (row: any) => {
    if (!activeFile || !activeSheet) return setToast("No active sheet");
    try {
      const res = await (window as any).api.invoke(
        "sheet:create",
        activeFile,
        activeSheet,
        row
      );
      if (res && res.error) {
        setToast(res.message || "Add failed");
        return;
      }
      setModal({ open: false, mode: null, data: null });
      await loadSheet(activeSheet, sheetRows.page);
      setToast("✅ Row added");
    } catch (err) {
      const e = err as any;
      setToast(
        "❌ Error adding row: " + (e && e.message ? e.message : String(e))
      );
    }
  };

  const deleteRow = async (row: any) => {
    if (!activeFile || !activeSheet) return setToast("❌ No active sheet");
    if (!confirm("Delete this row?")) return;

    const pkName = (config && config.pkName) || "id";
    const pkValue = row[pkName];
    const expected = row["_version"];

    try {
      const res = await (window as any).api.invoke(
        "sheet:delete",
        activeFile,
        activeSheet,
        pkValue,
        expected
      );

      if (res && res.error) {
        if (res.error === "version-conflict") {
          setToast("❌ Version conflict, reload sheet");
          await loadSheet(activeSheet, 1);
          return;
        }
        setToast("❌ " + (res.message || "Delete failed"));
        return;
      }

      // Refresh the sheet data immediately
      await loadSheet(activeSheet, sheetRows.page);
      setToast("✅ Row deleted");
    } catch (error) {
      console.error("Delete error:", error);
      setToast("❌ Delete failed");
    }
  };

  // Excel-like handlers
  const handleCellEdit = async (
    rowIndex: number,
    colKey: string,
    value: any
  ) => {
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
      setToast("✅ Cell updated successfully");
    } catch (error) {
      console.error("Error updating cell:", error);
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

  // Pagination calculation
  const totalPages = Math.max(
    1,
    Math.ceil(
      (sheetRows && sheetRows.total ? sheetRows.total : 0) /
        (sheetRows.pageSize || (config && config.pageSizeDefault) || 25)
    )
  );

  return (
    <div className={dark ? "dark" : ""}>
      <div className="flex h-screen flex-col bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900 dark:from-gray-900 dark:to-gray-800 dark:text-gray-100 relative">
        <header className="flex flex-col">
          {/* Title Bar */}
          <div className="h-12 px-4 border-b border-gray-200/50 flex items-center gap-3 bg-white/80 dark:bg-gray-900/70 backdrop-blur-sm shadow-sm z-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">📊</span>
              </div>
              <div className="flex-1 font-semibold text-gray-800 dark:text-gray-100 text-lg">
                Excel Database
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip content="Choose a different folder">
                <button
                  onClick={async () => {
                    try {
                      const result = await (window as any).api.invoke(
                        "folder:pick"
                      );
                      if (result) {
                        setConfig((prev: any) => ({
                          ...prev,
                          folderPath: result,
                        }));
                        refreshFiles();
                      }
                    } catch (error) {
                      setToast("❌ Failed to pick folder");
                    }
                  }}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  📁
                </button>
              </Tooltip>
              <Tooltip
                content={dark ? "Switch to light mode" : "Switch to dark mode"}>
                <button
                  onClick={() => setDark(!dark)}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  {dark ? "☀️" : "🌙"}
                </button>
              </Tooltip>
              <Tooltip content="Refresh all files">
                <button
                  onClick={refreshFiles}
                  className="p-2 rounded-lg text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
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
                    await (window as any).api.invoke(
                      "workbook:save",
                      activeFile
                    );
                    setToast("✅ Saved successfully");
                  } else {
                    setToast("❌ No file to save");
                  }
                } catch (error) {
                  setToast("❌ Save failed");
                }
              }}
              onCopy={() => {
                if (selectedCell) {
                  const cellValue =
                    sheetRows.rows[selectedCell.row]?.[
                      sheetRows.headers[selectedCell.col]
                    ] || "";
                  navigator.clipboard.writeText(String(cellValue));
                  setToast("✅ Copied to clipboard");
                } else {
                  setToast("❌ No cell selected");
                }
              }}
              onPaste={() => {
                if (selectedCell) {
                  navigator.clipboard.readText().then((text) => {
                    const header = sheetRows.headers[selectedCell.col];
                    if (header) {
                      handleCellEdit(selectedCell.row, header, text);
                      setToast("✅ Pasted from clipboard");
                    }
                  });
                } else {
                  setToast("❌ No cell selected");
                }
              }}
              onCut={() => {
                if (selectedCell) {
                  const cellValue =
                    sheetRows.rows[selectedCell.row]?.[
                      sheetRows.headers[selectedCell.col]
                    ] || "";
                  navigator.clipboard.writeText(String(cellValue));
                  const header = sheetRows.headers[selectedCell.col];
                  if (header) {
                    handleCellEdit(selectedCell.row, header, "");
                  }
                  setToast("✅ Cut to clipboard");
                } else {
                  setToast("❌ No cell selected");
                }
              }}
              onAddRow={() =>
                setModal({
                  open: true,
                  mode: "add",
                  data: {},
                  errors: {},
                  conflict: null,
                })
              }
              onDeleteRow={() => {
                if (selectedCell && selectedCell.row >= 0) {
                  const confirmDelete = window.confirm(
                    "Are you sure you want to delete this row?"
                  );
                  if (confirmDelete) {
                    deleteRow(sheetRows.rows[selectedCell.row]);
                  }
                } else {
                  setToast("❌ No row selected");
                }
              }}
              onSort={(direction) => {
                // toolbar sorts act on the currently selected column
                if (!selectedCell)
                  return setToast("❌ Select a column header first to sort");
                const header = sheetRows.headers[selectedCell.col];
                if (!header) return setToast("❌ No column selected");

                if (direction === "reset") {
                  setSortState(null);
                  if (activeSheet) loadSheet(activeSheet, 1, undefined);
                  setToast(`✅ Reset sort on ${header}`);
                  return;
                }

                const newSort = { key: header, dir: direction } as any;
                setSortState(newSort);
                if (activeSheet) loadSheet(activeSheet, 1, newSort);
                setToast(`✅ Sorted ${header} ${direction}`);
              }}
              onFilter={() => {
                // open filter modal for global filter
                setFilterModalHeader(null);
                setFilterModalInitial(filterText || "");
                setFilterModalOpen(true);
              }}
              readOnly={false}
            />
          </div>

          {/* Formula Bar */}
          <div className="z-0">
            <FormulaBar
              selectedCell={selectedCell}
              cellValue={
                selectedCell
                  ? sheetRows.rows[selectedCell.row]?.[
                      sheetRows.headers[selectedCell.col]
                    ] || ""
                  : ""
              }
              onCellValueChange={handleFormulaBarChange}
              headers={sheetRows.headers}
            />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <Sidebar
            files={files}
            onOpen={(f: any) => openWorkbook(f)}
            onRefresh={refreshFiles}
            onPickFolder={pickFolder}
          />
          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            {meta && (
              <SheetTabs
                sheets={meta.sheets || []}
                active={activeSheet}
                onSelect={(s: string) => loadSheet(s, 1)}
              />
            )}

            <main className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Quick Filter Bar */}
              <div
                className="px-4 border-b border-blue-200/50 flex items-center gap-3 bg-gradient-to-r from-blue-50/60 to-indigo-50/60 dark:bg-gradient-to-r dark:from-gray-900 dark:to-gray-800 dark:border-gray-700 backdrop-blur-sm flex-shrink-0"
                style={{ height: "39.5px" }}>
                <div className="relative">
                  <Tooltip content="Search and filter data across all columns">
                    <input
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="🔍 Search data..."
                      className="pl-4 pr-12 h-8 py-0 rounded-md border border-blue-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/90 dark:bg-blue-900/60 dark:text-white placeholder-gray-600 dark:placeholder-white/70 backdrop-blur-sm transition-all duration-200"
                    />
                  </Tooltip>
                </div>
                <div className="ml-auto text-sm text-blue-700 dark:text-blue-100 truncate bg-blue-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 rounded-md border border-blue-200 dark:border-transparent chosen-folder-name flex items-center px-3 h-8">
                  {meta ? meta.path.split("/").pop() : "No file selected"}
                </div>
              </div>

              {/* Excel Grid */}
              {activeSheet && (
                <div
                  className="flex-1 overflow-hidden min-h-0"
                  onContextMenu={handleContextMenu}>
                  <ExcelGrid
                    headers={sheetRows.headers || []}
                    rows={sheetRows.rows || []}
                    hiddenColumns={hiddenColumns}
                    onCellEdit={handleCellEdit}
                    onRowAdd={openAddModal}
                    onRowDelete={(rowIndex) => {
                      if (sheetRows.rows[rowIndex]) {
                        deleteRow(sheetRows.rows[rowIndex]);
                      }
                    }}
                    readOnly={(
                      (config && config.readOnlySheets) ||
                      []
                    ).includes(activeSheet || "")}
                    selectedCell={selectedCell}
                    onCellSelect={setSelectedCell}
                    startIndex={
                      ((sheetRows.page || 1) - 1) *
                      (sheetRows.pageSize ||
                        (config && config.pageSizeDefault) ||
                        25)
                    }
                    sortState={
                      sortState
                        ? {
                            column: sortState.key || "",
                            direction: sortState.dir,
                          }
                        : undefined
                    }
                    onRequestContextMenu={handleGridContextRequest}
                    onSort={(column) => {
                      // cycle: none -> asc -> desc -> reset (none)
                      if (!sortState || sortState.key !== column) {
                        const newSort = { key: column, dir: "asc" } as any;
                        setSortState(newSort);
                        if (activeSheet) loadSheet(activeSheet, 1, newSort);
                        return;
                      }
                      if (sortState.key === column && sortState.dir === "asc") {
                        const newSort = { key: column, dir: "desc" } as any;
                        setSortState(newSort);
                        if (activeSheet) loadSheet(activeSheet, 1, newSort);
                        return;
                      }
                      // currently desc, so reset
                      setSortState(null);
                      if (activeSheet) loadSheet(activeSheet, 1, undefined);
                    }}
                  />
                </div>
              )}

              {/* pagination is rendered in StatusBar */}
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
                  setToast("✅ Overwrite succeeded");
                }
              } catch (err) {
                const e = err as any;
                setToast(
                  "❌ Error overwriting: " +
                    (e && e.message ? e.message : String(e))
                );
              }
              if (activeSheet) await loadSheet(activeSheet, sheetRows.page);
              setModal({ open: false, mode: null, data: null });
            }
          }}
        />

        <FilterModal
          open={filterModalOpen}
          headerOptions={sheetRows.headers || []}
          initialHeader={filterModalHeader}
          initialValue={filterModalInitial}
          onClose={() => setFilterModalOpen(false)}
          onApply={async (header: string | null, value: string) => {
            // compute next columnFilters synchronously and persist
            const next = (() => {
              const prev = columnFilters || {};
              const clone: Record<string, string> = { ...(prev || {}) };
              if (header) {
                if (value) clone[header] = value;
                else delete clone[header];
              } else {
                // apply across all columns by setting a global filterText
                setFilterText(value);
              }
              return clone;
            })();

            setColumnFilters(next);

            // persist columnFilters per workbook using the freshly computed object
            try {
              if (activeFile) {
                await (window as any).api.sort.set(activeFile, {
                  columnFilters: next,
                });
              }
            } catch (err) {}

            // reload sheet
            if (activeSheet) await loadSheet(activeSheet, 1);
            setFilterModalOpen(false);
          }}
        />

        {/* Status Bar */}
        <div className="z-0 flex-shrink-0">
          <StatusBar
            selectedCell={selectedCell}
            totalRows={sheetRows.total}
            totalCols={sheetRows.headers.length}
            readOnly={false}
            activeSheet={activeSheet || undefined}
            page={sheetRows.page}
            totalPages={totalPages}
            onPrevPage={() => {
              if (sheetRows.page > 1 && activeSheet)
                loadSheet(activeSheet, sheetRows.page - 1);
            }}
            onNextPage={() => {
              if (sheetRows.page < totalPages && activeSheet)
                loadSheet(activeSheet, sheetRows.page + 1);
            }}
            onJumpPage={(n: number) => {
              if (!activeSheet) return;
              const target = Math.max(1, Math.min(n, totalPages));
              if (target !== sheetRows.page) loadSheet(activeSheet, target);
            }}
          />
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            header={contextMenu.header}
            onCopy={() => setToast("✅ Copied to clipboard")}
            onPaste={() => setToast("✅ Pasted from clipboard")}
            onInsertRow={openAddModal}
            onDeleteRow={() => {
              if (selectedCell && sheetRows.rows[selectedCell.row]) {
                deleteRow(sheetRows.rows[selectedCell.row]);
              }
            }}
            onHideColumn={async () => {
              if (!contextMenu || !contextMenu.header) return;
              const hdr = contextMenu.header;
              setHiddenColumns((prev) => {
                const next = { ...(prev || {}) };
                next[hdr] = true;
                return next;
              });
              // persist
              try {
                if (activeFile)
                  await (window as any).api.sort.set(activeFile, {
                    hiddenColumns: { ...(hiddenColumns || {}), [hdr]: true },
                  });
              } catch (err) {}
              setContextMenu(null);
            }}
            onSort={(direction) => {
              // If contextMenu.header exists, apply to that column; otherwise use selectedCell
              const hdr =
                contextMenu?.header ||
                (selectedCell ? sheetRows.headers[selectedCell.col] : null);
              if (!hdr) return;
              if (direction === "reset") {
                setSortState(null);
                if (activeSheet) loadSheet(activeSheet, 1, undefined);
                return;
              }
              const newSort = { key: hdr, dir: direction } as any;
              setSortState(newSort);
              if (activeSheet) {
                loadSheet(activeSheet, 1, newSort);
              }
            }}
            onFilter={() => {
              if (contextMenu && contextMenu.header) {
                // open column filter modal for header
                setFilterModalHeader(contextMenu.header);
                setFilterModalInitial(columnFilters[contextMenu.header] || "");
                setFilterModalOpen(true);
                setContextMenu(null);
                return;
              }
              const filterValue = prompt("Enter filter value:");
              if (filterValue !== null) {
                setFilterText(filterValue);
                setToast(`✅ Filtered by: ${filterValue}`);
                if (activeSheet) loadSheet(activeSheet, 1);
              }
            }}
            readOnly={((config && config.readOnlySheets) || []).includes(
              activeSheet || ""
            )}
          />
        )}

        {toast && (
          <Toast
            message={toast}
            type={
              toast.includes("error") || toast.includes("failed")
                ? "error"
                : "success"
            }
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}
