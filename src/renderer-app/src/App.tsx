import React, { useCallback, useEffect, useState } from "react";
import CrudModal from "./components/CrudModal";
import DataGrid from "./components/DataGrid";
import SheetTabs from "./components/SheetTabs";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
import "./index.css";

type FileEntry = { name: string; path: string; size: number; mtimeMs: number };

export default function App() {
  const [dark, setDark] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [recentWorkbooks, setRecentWorkbooks] = useState<string[]>([]);

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

  // Load config and initial folder scan
  useEffect(() => {
    (async () => {
      try {
        const cfg = await (window as any).api.config.get();
        setConfig(cfg || {});

        // Load recent workbooks
        const recent = await (window as any).api.config.getRecentWorkbooks();
        setRecentWorkbooks(recent || []);

        const folder = cfg && cfg.folderPath;
        if (!folder) {
          const p = await (window as any).api.folder.pick();
          if (p) {
            await (window as any).api.config.set({ folderPath: p });
            setConfig((prev: any) => ({ ...(prev || {}), folderPath: p }));
            const res = await (window as any).api.folder.scan(p);
            if (!res.error) setFiles(res.files || []);
          } else {
            setToast("No folder selected");
          }
        } else {
          const res = await (window as any).api.folder.scan(folder);
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
      const res = await (window as any).api.folder.scan(folder);
      if (!res.error) setFiles(res.files || []);
    } catch (e) {
      console.error(e);
    }
  }, [config]);

  const openWorkbook = useCallback(
    async (file: FileEntry) => {
      try {
        setActiveFile(file.path);

        // Add to recent workbooks
        await (window as any).api.config.addRecentWorkbook(file.path);
        const recent = await (window as any).api.config.getRecentWorkbooks();
        setRecentWorkbooks(recent || []);

        const m = await (window as any).api.workbook.meta(file.path);
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
            const sort = await (window as any).api.sort.get(file.path);
            // store into state if needed; for now we just set columnFilters to empty
            // DataGrid will reflect sort via server-side ordering when implemented
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
        const res = await (window as any).api.sheet.read(
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

    // Check if sheet is read-only
    const isReadOnly = await (window as any).api.config.isSheetReadOnly(
      activeSheet
    );
    if (isReadOnly) {
      setToast("Cannot add rows to read-only sheet");
      return;
    }

    const res = await (window as any).api.sheet.create(
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

    // Check if sheet is read-only
    const isReadOnly = await (window as any).api.config.isSheetReadOnly(
      activeSheet
    );
    if (isReadOnly) {
      setToast("Cannot edit rows in read-only sheet");
      return;
    }

    const pkName = (config && config.pkName) || "id";
    const pkValue = row[pkName];
    const expected = row["_version"];
    const updates = Object.assign({}, row);
    delete updates[pkName];
    delete updates["_version"];
    const res = await (window as any).api.sheet.update(
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

    // Check if sheet is read-only
    const isReadOnly = await (window as any).api.config.isSheetReadOnly(
      activeSheet
    );
    if (isReadOnly) {
      setToast("Cannot delete rows from read-only sheet");
      return;
    }

    if (!confirm("Delete this row?")) return;
    const pkName = (config && config.pkName) || "id";
    const pkValue = row[pkName];
    const expected = row["_version"];
    const res = await (window as any).api.sheet.delete(
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

  const exportWorkbook = async () => {
    if (!activeFile) return setToast("No active workbook");
    try {
      const res = await (window as any).api.workbook.export(activeFile);
      if (res && !res.error) {
        setToast(`Workbook exported to: ${res.path}`);
      } else {
        setToast(res.message || "Export failed");
      }
    } catch (err) {
      const e = err as any;
      setToast("Export error: " + (e && e.message ? e.message : String(e)));
    }
  };

  useEffect(() => {
    if (activeSheet) loadSheet(activeSheet, sheetRows.page);
  }, [activeSheet, sheetRows.page, filterText]);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <header className="p-2 border-b flex items-center gap-2">
          <div className="flex-1 font-semibold">Excel DB</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((d) => !d)}
              className="px-3 py-1 rounded bg-gray-200">
              Theme
            </button>
            {activeFile && (
              <button
                onClick={exportWorkbook}
                className="px-3 py-1 rounded bg-green-500 text-white">
                Export
              </button>
            )}
            {activeFile && (
              <button
                onClick={openConfigModal}
                className="px-3 py-1 rounded bg-purple-500 text-white">
                Config
              </button>
            )}
            {activeSheet &&
              !((config && config.readOnlySheets) || []).includes(
                activeSheet || ""
              ) && (
                <button
                  onClick={openAddModal}
                  className="px-3 py-1 rounded bg-blue-500 text-white">
                  Add Row
                </button>
              )}
            <button
              onClick={refreshFiles}
              className="px-3 py-1 rounded bg-gray-200">
              Refresh
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            files={files}
            recentWorkbooks={recentWorkbooks}
            activePath={activeFile}
            onOpen={(f: any) => openWorkbook(f)}
            onRefresh={refreshFiles}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            {meta && (
              <SheetTabs
                sheets={meta.sheets || []}
                active={activeSheet}
                onSelect={(s: string) => loadSheet(s, 1)}
                readOnlySheets={config?.readOnlySheets || []}
              />
            )}

            <main className="flex-1 p-4 overflow-auto">
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter"
                  className="border px-2 py-1 rounded w-64"
                />
                <div className="ml-auto">{meta ? meta.path : ""}</div>
              </div>

              {activeSheet && (
                <DataGrid
                  headers={sheetRows.headers || []}
                  rows={sheetRows.rows || []}
                  onEdit={(r: any) => openEditModal(r)}
                  onDelete={(r: any) => deleteRow(r)}
                  readOnly={((config && config.readOnlySheets) || []).includes(
                    activeSheet || ""
                  )}
                  page={sheetRows.page}
                  pageSize={sheetRows.pageSize}
                  total={sheetRows.total}
                  onPageChange={(p: number) => loadSheet(activeSheet, p)}
                  filter={filterText}
                  onSearch={(q: string) => {
                    setFilterText(q);
                    // reset to page 1
                    if (activeSheet) loadSheet(activeSheet, 1);
                  }}
                  onColumnFilters={(filters: Record<string, string>) => {
                    setColumnFilters(filters || {});
                    if (activeSheet) loadSheet(activeSheet, 1);
                  }}
                  onSortChange={async (s: {
                    key: string | null;
                    dir: "asc" | "desc";
                  }) => {
                    setSortState(s);
                    try {
                      await (window as any).api.sort.set(activeFile, s);
                    } catch (e) {
                      console.warn("Failed to persist sort state", e);
                    }
                    if (activeSheet) loadSheet(activeSheet, 1);
                  }}
                />
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
                const res = await (window as any).api.sheet.update(
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

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
