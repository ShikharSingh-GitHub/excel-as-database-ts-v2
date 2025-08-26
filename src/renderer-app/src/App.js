import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import CrudModal from "./components/CrudModal";
import DataGrid from "./components/DataGrid";
import SheetTabs from "./components/SheetTabs";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
import "./index.css";
export default function App() {
    const [dark, setDark] = useState(false);
    const [config, setConfig] = useState(null);
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [meta, setMeta] = useState(null);
    const [activeSheet, setActiveSheet] = useState(null);
    const [sheetRows, setSheetRows] = useState({
        rows: [],
        total: 0,
        page: 1,
        pageSize: 25,
        headers: [],
    });
    const [filterText, setFilterText] = useState("");
    const [modal, setModal] = useState({
        open: false,
        mode: null,
        data: null,
        errors: null,
        conflict: null,
    });
    const [toast, setToast] = useState(null);
    // Load config and initial folder scan
    useEffect(() => {
        (async () => {
            try {
                const cfg = await window.api.invoke("config:get");
                setConfig(cfg || {});
                const folder = cfg && cfg.folderPath;
                if (!folder) {
                    const p = await window.api.invoke("folder:pick");
                    if (p) {
                        await window.api.invoke("config:set", { folderPath: p });
                        setConfig((prev) => ({ ...(prev || {}), folderPath: p }));
                        const res = await window.api.invoke("folder:scan", p);
                        if (!res.error)
                            setFiles(res.files || []);
                    }
                    else {
                        setToast("No folder selected");
                    }
                }
                else {
                    const res = await window.api.invoke("folder:scan", folder);
                    if (!res.error)
                        setFiles(res.files || []);
                }
            }
            catch (err) {
                const e = err;
                console.error(e);
                setToast("Startup error: " + (e && e.message ? e.message : String(e)));
            }
        })();
    }, []);
    const refreshFiles = useCallback(async () => {
        try {
            const folder = (config && config.folderPath) || null;
            if (!folder)
                return;
            const res = await window.api.invoke("folder:scan", folder);
            if (!res.error)
                setFiles(res.files || []);
        }
        catch (e) {
            console.error(e);
        }
    }, [config]);
    const openWorkbook = useCallback(async (file) => {
        try {
            setActiveFile(file.path);
            const m = await window.api.invoke("workbook:meta", file.path);
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
            }
            else {
                setToast(m.message || "Failed to load workbook metadata");
                setActiveFile(null);
            }
        }
        catch (err) {
            const e = err;
            setToast("Error opening workbook: " + (e && e.message ? e.message : String(e)));
            setActiveFile(null);
        }
    }, [config]);
    const loadSheet = useCallback(async (sheetName, page = 1) => {
        if (!activeFile || !sheetName)
            return;
        try {
            const res = await window.api.invoke("sheet:read", activeFile, sheetName, {
                page,
                pageSize: sheetRows.pageSize || (config && config.pageSizeDefault) || 25,
                filter: filterText,
            });
            if (res && !res.error) {
                setSheetRows(res);
                setActiveSheet(sheetName);
            }
            else {
                setToast(res.message || "Failed to load sheet");
            }
        }
        catch (err) {
            const e = err;
            setToast("Error loading sheet: " + (e && e.message ? e.message : String(e)));
        }
    }, [activeFile, filterText, sheetRows.pageSize, config]);
    // CRUD operations
    const openAddModal = () => setModal({ open: true, mode: "add", data: {}, errors: {} });
    const submitAdd = async (data) => {
        if (!activeFile || !activeSheet)
            return setToast("No active sheet");
        const res = await window.api.invoke("sheet:create", activeFile, activeSheet, data);
        if (res && res.error) {
            setToast(res.message || "Add failed");
            return;
        }
        setModal({ open: false, mode: null, data: null });
        await loadSheet(activeSheet, 1);
        setToast("Row added");
    };
    const openEditModal = (row) => setModal({
        open: true,
        mode: "edit",
        data: JSON.parse(JSON.stringify(row)),
        errors: {},
    });
    const submitEdit = async (row) => {
        if (!activeFile || !activeSheet)
            return setToast("No active sheet");
        const pkName = (config && config.pkName) || "id";
        const pkValue = row[pkName];
        const expected = row["_version"];
        const updates = Object.assign({}, row);
        delete updates[pkName];
        delete updates["_version"];
        const res = await window.api.invoke("sheet:update", activeFile, activeSheet, pkValue, updates, expected);
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
    const deleteRow = async (row) => {
        if (!activeFile || !activeSheet)
            return setToast("No active sheet");
        if (!confirm("Delete this row?"))
            return;
        const pkName = (config && config.pkName) || "id";
        const pkValue = row[pkName];
        const expected = row["_version"];
        const res = await window.api.invoke("sheet:delete", activeFile, activeSheet, pkValue, expected);
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
    useEffect(() => {
        if (activeSheet)
            loadSheet(activeSheet, sheetRows.page);
    }, [activeSheet, sheetRows.page, filterText]);
    return (_jsx("div", { className: dark ? "dark" : "", children: _jsxs("div", { className: "flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100", children: [_jsxs("header", { className: "p-2 border-b flex items-center gap-2", children: [_jsx("div", { className: "flex-1 font-semibold", children: "Excel DB" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setDark((d) => !d), className: "px-3 py-1 rounded bg-gray-200", children: "Theme" }), _jsx("button", { onClick: openAddModal, className: "px-3 py-1 rounded bg-blue-500 text-white", children: "Add Row" }), _jsx("button", { onClick: refreshFiles, className: "px-3 py-1 rounded bg-gray-200", children: "Refresh" })] })] }), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [_jsx(Sidebar, { files: files, activePath: activeFile, onOpen: (f) => openWorkbook(f), onRefresh: refreshFiles }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [meta && (_jsx(SheetTabs, { sheets: meta.sheets || [], active: activeSheet, onSelect: (s) => loadSheet(s, 1) })), _jsxs("main", { className: "flex-1 p-4 overflow-auto", children: [_jsxs("div", { className: "mb-3 flex items-center gap-2", children: [_jsx("input", { value: filterText, onChange: (e) => setFilterText(e.target.value), placeholder: "Filter", className: "border px-2 py-1 rounded w-64" }), _jsx("div", { className: "ml-auto", children: meta ? meta.path : "" })] }), activeSheet && (_jsx(DataGrid, { headers: sheetRows.headers || [], rows: sheetRows.rows || [], onEdit: (r) => openEditModal(r), onDelete: (r) => deleteRow(r), page: sheetRows.page, pageSize: sheetRows.pageSize, total: sheetRows.total, onPageChange: (p) => loadSheet(activeSheet, p), filter: filterText, onSearch: (q) => {
                                                setFilterText(q);
                                                // reset to page 1
                                                if (activeSheet)
                                                    loadSheet(activeSheet, 1);
                                            } }))] })] })] }), _jsx(CrudModal, { open: modal.open, mode: modal.mode, conflict: modal.conflict, title: modal.mode === "add"
                        ? "Add Row"
                        : modal.mode === "edit"
                            ? "Edit Row"
                            : "Conflict", headers: sheetRows.headers || [], data: modal.data || {}, errors: modal.errors || {}, onClose: () => setModal({ open: false, mode: null, data: null }), onSubmit: () => {
                        if (modal.mode === "add")
                            submitAdd(modal.data);
                        else if (modal.mode === "edit")
                            submitEdit(modal.data);
                    }, onChange: (header, value) => setModal((prev) => ({
                        ...prev,
                        data: { ...(prev.data || {}), [header]: value },
                    })), onResolve: async (action) => {
                        if (action === "reload") {
                            if (activeSheet)
                                await loadSheet(activeSheet, 1);
                            setModal({ open: false, mode: null, data: null });
                        }
                        else if (action === "overwrite") {
                            // attempt to apply user's data on top of current by using current _version
                            try {
                                const pkName = (config && config.pkName) || "id";
                                const row = modal.data || {};
                                const pkValue = row[pkName];
                                const updates = { ...row };
                                delete updates[pkName];
                                delete updates["_version"];
                                const expected = modal.conflict && modal.conflict["_version"];
                                const res = await window.api.invoke("sheet:update", activeFile, activeSheet, pkValue, updates, expected);
                                if (res && res.error) {
                                    setToast(res.message || "Overwrite failed");
                                }
                                else {
                                    setToast("Overwrite succeeded");
                                }
                            }
                            catch (err) {
                                const e = err;
                                setToast("Error overwriting: " +
                                    (e && e.message ? e.message : String(e)));
                            }
                            if (activeSheet)
                                await loadSheet(activeSheet, sheetRows.page);
                            setModal({ open: false, mode: null, data: null });
                        }
                    } }), toast && _jsx(Toast, { message: toast, onClose: () => setToast(null) })] }) }));
}
//# sourceMappingURL=App.js.map