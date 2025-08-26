const Sidebar = window.Sidebar;
const SheetTabs = window.SheetTabs;
const DataGrid = window.DataGrid;
const CrudModal = window.CrudModal;
const Toast = window.Toast;

// UMD-compatible App (uses global React)
(function () {
  const { useState, useEffect } = React;

  function App() {
    const [config, setConfig] = useState(null);
    const [folder, setFolder] = useState("");
    const [files, setFiles] = useState([]);
    const [active, setActive] = useState(null);
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
    const [modal, setModal] = useState({ open: false, mode: null, data: null });
    const [toast, setToast] = useState(null);
    const [sortConfig, setSortConfig] = useState({
      key: null,
      direction: "asc",
    });
    const [darkMode, setDarkMode] = useState(false);

    function Modal({ open, title, children, onClose }) {
      if (!open) return null;
      return React.createElement(
        "div",
        {
          style: {
            position: "fixed",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          },
        },
        React.createElement(
          "div",
          {
            style: {
              background: "#fff",
              padding: 32,
              minWidth: 400,
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
              borderRadius: 12,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif",
            },
          },
          React.createElement(
            "h3",
            {
              style: {
                marginTop: 0,
                marginBottom: 18,
                fontWeight: 600,
                fontSize: 22,
                color: "#2d3748",
              },
            },
            title
          ),
          children,
          React.createElement(
            "div",
            { style: { marginTop: 18, textAlign: "right" } },
            React.createElement(
              "button",
              {
                onClick: onClose,
                style: {
                  background: "#e2e8f0",
                  color: "#2d3748",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 18px",
                  marginRight: 8,
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "background 0.2s",
                },
                onMouseOver: (e) => (e.target.style.background = "#cbd5e1"),
                onMouseOut: (e) => (e.target.style.background = "#e2e8f0"),
              },
              "Close"
            )
          )
        )
      );
    }

    function Actions({ onEdit, onDelete }) {
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            marginTop: "10px",
          },
        },
        React.createElement(
          "button",
          {
            onClick: onEdit,
            style: {
              padding: "6px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.2s",
            },
            onMouseOver: (e) => (e.target.style.background = "#1d4ed8"),
            onMouseOut: (e) => (e.target.style.background = "#2563eb"),
          },
          "Edit"
        ),
        React.createElement(
          "button",
          {
            onClick: onDelete,
            style: {
              padding: "6px 16px",
              background: "#e11d48",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.2s",
            },
            onMouseOver: (e) => (e.target.style.background = "#be123c"),
            onMouseOut: (e) => (e.target.style.background = "#e11d48"),
          },
          "Delete"
        )
      );
    }

    useEffect(() => {
      (async () => {
        const cfg = await window.api.invoke("config:get");
        console.log("[DEBUG] Loaded config:", cfg); // Debug log
        setConfig(cfg);
        if (cfg && cfg.folderPath) {
          setFolder(cfg.folderPath);
          const res = await window.api.invoke("folder:scan", cfg.folderPath);
          console.log("[DEBUG] Scanned folder:", res); // Debug log
          if (res && !res.error) setFiles(res.files);
        } else {
          // FR-F1: On startup, if folderPath not set, show a folder picker
          console.log(
            "[DEBUG] No folderPath configured, showing folder picker"
          );
          showToast("Please select a folder containing Excel files", 3000);
          setTimeout(() => {
            pickFolder();
          }, 500);
        }
      })();
    }, []);

    async function pickFolder() {
      const p = await window.api.invoke("folder:pick");
      if (!p) return;
      setFolder(p);
      await window.api.invoke("config:set", { folderPath: p });
      const res = await window.api.invoke("folder:scan", p);
      if (res && !res.error) setFiles(res.files);
    }

    function showErrorToast(message) {
      showToast(`Error: ${message}`, 5000);
    }

    async function openWorkbook(file) {
      try {
        setActive(file.path);
        const m = await window.api.invoke("workbook:meta", file.path);
        console.log("[DEBUG] Opened workbook metadata:", m); // Debug log
        if (m.error) {
          showToast(m.message || "Failed to load workbook metadata", 5000);
          setActive(null);
          return;
        }
        setMeta(m);
        setActiveSheet(null);
        setSheetRows({
          rows: [],
          total: 0,
          page: 1,
          pageSize: 25,
          headers: [],
        });
      } catch (e) {
        showToast(e.message || "Unexpected error while opening workbook", 5000);
        setActive(null);
      }
    }

    async function loadSheet(sheetName, page = 1) {
      if (!active) return;
      try {
        console.log("[DEBUG] Loading sheet:", sheetName, "Page:", page); // Debug log
        const res = await window.api.invoke("sheet:read", active, sheetName, {
          page,
          pageSize: sheetRows.pageSize,
          filter: filterText,
        });
        console.log("[DEBUG] Loaded sheet data:", res); // Debug log
        if (res.error) {
          showErrorToast(res.message || "Failed to load sheet data");
          return;
        }
        setSheetRows(res);
        setActiveSheet(sheetName);
      } catch (e) {
        showErrorToast(e.message || "Unexpected error while loading sheet");
      }
    }

    // Modal-based add/edit flows
    function typeHintForColumn(col) {
      try {
        if (
          typeof window !== "undefined" &&
          window.RowUtils &&
          window.RowUtils.typeHintForColumn
        )
          return window.RowUtils.typeHintForColumn(col);
      } catch (e) {
        console.warn("RowUtils.typeHintForColumn not available, falling back");
      }
      // conservative fallback
      const lc = String(col || "").toLowerCase();
      if (lc.includes("date") || lc.includes("dob") || lc.includes("_at"))
        return "date";
      if (
        lc.includes("qty") ||
        lc.includes("price") ||
        lc.includes("amount") ||
        lc.endsWith("_id")
      )
        return "number";
      if (
        lc.startsWith("is") ||
        lc.startsWith("has") ||
        lc.startsWith("active") ||
        lc.startsWith("enabled")
      )
        return "checkbox";
      return "text";
    }

    // Normalize modal inputs to proper JS types before sending to backend
    function normalizeRowForSubmit(row) {
      try {
        if (
          typeof window !== "undefined" &&
          window.RowUtils &&
          window.RowUtils.normalizeRowForSubmit
        )
          return window.RowUtils.normalizeRowForSubmit(
            row,
            sheetRows.headers || []
          );
      } catch (e) {
        console.warn(
          "RowUtils.normalizeRowForSubmit not available, falling back"
        );
      }
      // fallback: simple normalization
      if (!row) return row;
      const headers =
        sheetRows.headers && sheetRows.headers.length
          ? sheetRows.headers
          : Object.keys(row);
      const out = {};
      headers.forEach((h) => {
        const t = typeHintForColumn(h);
        let v = row[h];
        if (v === undefined || v === null) {
          out[h] = "";
          return;
        }
        if (t === "number") {
          const n = Number(v);
          out[h] = Number.isNaN(n) ? v : n;
          return;
        }
        if (t === "checkbox") {
          out[h] = !!v;
          return;
        }
        if (t === "date") {
          const d = new Date(v);
          out[h] = isNaN(d.getTime()) ? v : d.toISOString();
          return;
        }
        out[h] = v;
      });
      Object.keys(row).forEach((k) => {
        if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = row[k];
      });
      return out;
    }

    // Basic validation: numbers must parse, dates must parse when provided
    function validateRow(row) {
      try {
        if (
          typeof window !== "undefined" &&
          window.RowUtils &&
          window.RowUtils.validateRow
        )
          return window.RowUtils.validateRow(row, sheetRows.headers || []);
      } catch (e) {
        console.warn("RowUtils.validateRow not available, falling back");
      }
      const errors = {};
      const headers =
        sheetRows.headers && sheetRows.headers.length
          ? sheetRows.headers
          : Object.keys(row || {});
      headers.forEach((h) => {
        const isRequired =
          h &&
          (String(h).trim().endsWith("*") || /\(required\)/i.test(String(h)));
        const t = typeHintForColumn(h);
        const v = row ? row[h] : undefined;
        if (isRequired) {
          if (v === "" || v === null || v === undefined) {
            errors[h] = "Required";
            return;
          }
        }
        if (t === "number") {
          if (v !== "" && v !== null && v !== undefined) {
            const n = Number(v);
            if (Number.isNaN(n)) errors[h] = "Must be a number";
          }
        }
        if (t === "date") {
          if (v) {
            const d = new Date(v);
            if (isNaN(d.getTime())) errors[h] = "Invalid date";
          }
        }
      });
      return errors;
    }

    function openAddModal() {
      const headers = sheetRows.headers || [];
      const data = {};
      headers.forEach((h) => (data[h] = ""));
      setModal({ open: true, mode: "add", data });
    }

    async function submitAdd(data) {
      if (isReadOnly(activeSheet)) {
        showToast(
          "This sheet is read-only. Add operation is not allowed.",
          5000
        );
        return;
      }
      try {
        const vErrors = validateRow(data);
        if (Object.keys(vErrors).length) {
          setModal((prev) => Object.assign({}, prev, { errors: vErrors }));
          return;
        }
        const payload = normalizeRowForSubmit(data);
        const res = await window.api.invoke(
          "sheet:create",
          active,
          activeSheet,
          payload
        );
        if (res && res.error) {
          showErrorToast(res.message || "Failed to add row. Please try again.");
          return;
        }
        setModal({
          open: false,
          mode: null,
          data: null,
          errors: null,
          conflict: null,
        });
        loadSheet(activeSheet, 1);
        showToast("Row added successfully", 3000);
      } catch (e) {
        showErrorToast(e.message || "Unexpected error while adding row");
      }
    }

    function openEditModal(row) {
      setModal({
        open: true,
        mode: "edit",
        data: JSON.parse(JSON.stringify(row)),
      });
    }

    async function submitEdit(row) {
      if (isReadOnly(activeSheet)) {
        showToast(
          "This sheet is read-only. Edit operation is not allowed.",
          5000
        );
        return;
      }
      const pkName = (config && config.pkName) || "id";
      const pkValue = row[pkName];
      const expected = row["_version"];
      const vErrors = validateRow(row);
      if (Object.keys(vErrors).length) {
        setModal((prev) => Object.assign({}, prev, { errors: vErrors }));
        return;
      }
      const normalized = normalizeRowForSubmit(row);
      delete normalized[pkName];
      delete normalized["_version"];
      const res = await window.api.invoke(
        "sheet:update",
        active,
        activeSheet,
        pkValue,
        normalized,
        expected
      );
      if (res && res.error) {
        if (res.error === "version-conflict") {
          setModal({
            open: true,
            mode: "conflict",
            data: row,
            errors: null,
            conflict: { current: res.current },
          });
          return;
        }
        showToast(
          "Update error: " +
            res.error +
            (res.message ? " - " + res.message : "")
        );
        return;
      }
      setModal({
        open: false,
        mode: null,
        data: null,
        errors: null,
        conflict: null,
      });
      loadSheet(activeSheet, sheetRows.page);
      showToast("Row updated successfully", 3000);
    }

    // Conflict handlers
    async function conflictOverwrite() {
      if (!modal || !modal.conflict || !modal.conflict.current) return;
      const current = modal.conflict.current;
      const local = modal.data;
      const pkName = (config && config.pkName) || "id";
      const pkValue = local[pkName];
      const expected = current["_version"];
      const normalized = normalizeRowForSubmit(local);
      delete normalized[pkName];
      delete normalized["_version"];
      const res = await window.api.invoke(
        "sheet:update",
        active,
        activeSheet,
        pkValue,
        normalized,
        expected
      );
      if (res && res.error) {
        alert(
          "Overwrite failed: " +
            res.error +
            (res.message ? " - " + res.message : "")
        );
        if (res.error === "version-conflict" && res.current) {
          setModal((prev) =>
            Object.assign({}, prev, { conflict: { current: res.current } })
          );
        }
        return;
      }
      setModal({
        open: false,
        mode: null,
        data: null,
        errors: null,
        conflict: null,
      });
      loadSheet(activeSheet, sheetRows.page);
      showToast("Conflict resolved by overwriting", 3000);
    }

    function conflictReload() {
      setModal({
        open: false,
        mode: null,
        data: null,
        errors: null,
        conflict: null,
      });
      loadSheet(activeSheet, 1);
    }

    // UX helpers
    function getFieldPreview(h) {
      try {
        if (!modal || !modal.data) return "";
        const normalized = normalizeRowForSubmit(modal.data || {});
        const v = normalized[h];
        if (v === undefined || v === null)
          return String(v === null ? "null" : "");
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      } catch (e) {
        return "";
      }
    }

    function modalSubmit() {
      if (!modal) return;
      if (modal.mode === "add") submitAdd(modal.data);
      else if (modal.mode === "edit") submitEdit(modal.data);
    }

    // Simple toast helper
    function showToast(msg, ms = 3000) {
      try {
        setToast(String(msg || ""));
        if (ms && ms > 0) setTimeout(() => setToast(null), ms);
      } catch (e) {
        // ignore
      }
    }

    async function deleteRow(row) {
      if (isReadOnly(activeSheet)) {
        showToast(
          "This sheet is read-only. Delete operation is not allowed.",
          5000
        );
        return;
      }
      if (!confirm("Delete this row?")) return;
      const pkName = (config && config.pkName) || "id";
      const pkValue = row[pkName];
      const expected = row["_version"];
      const res = await window.api.invoke(
        "sheet:delete",
        active,
        activeSheet,
        pkValue,
        expected
      );
      if (res && res.error) {
        if (res.error === "version-conflict") {
          alert("Version conflict. Latest row: " + JSON.stringify(res.current));
          loadSheet(activeSheet, 1);
        } else
          showToast(
            "Delete error: " +
              res.error +
              (res.message ? " - " + res.message : "")
          );
        return;
      }
      showToast("Row deleted successfully", 3000);
      loadSheet(activeSheet, 1);
    }

    async function refreshFiles() {
      const res = await window.api.invoke("folder:refresh");
      if (res && !res.error) setFiles(res.files);
    }

    function sortRows(rows, headers) {
      if (!sortConfig.key) return rows;
      const sorted = [...rows].sort((a, b) => {
        const aVal = a[sortConfig.key] || "";
        const bVal = b[sortConfig.key] || "";
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }

    function isReadOnly(sheetName) {
      if (!config || !config.readOnlySheets) return false;
      return config.readOnlySheets.includes(sheetName);
    }

    function handleSort(header) {
      setSortConfig((prev) => {
        if (prev.key === header) {
          return {
            key: header,
            direction: prev.direction === "asc" ? "desc" : "asc",
          };
        }
        return { key: header, direction: "asc" };
      });
    }

    useEffect(() => {
      function handleKeyDown(event) {
        if (event.key === "ArrowRight" && activeSheet) {
          const currentIndex = meta.sheets.findIndex(
            (s) => s.name === activeSheet
          );
          if (currentIndex < meta.sheets.length - 1) {
            loadSheet(meta.sheets[currentIndex + 1].name);
          }
        } else if (event.key === "ArrowLeft" && activeSheet) {
          const currentIndex = meta.sheets.findIndex(
            (s) => s.name === activeSheet
          );
          if (currentIndex > 0) {
            loadSheet(meta.sheets[currentIndex - 1].name);
          }
        } else if (event.key === "Escape" && modal.open) {
          setModal({ open: false, mode: null, data: null });
        }
      }

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [activeSheet, meta, modal]);

    useEffect(() => {
      const cfg = config || {};
      if (cfg.autoRefreshSeconds > 0) {
        const interval = setInterval(async () => {
          console.log("[DEBUG] Auto-refresh triggered"); // Debug log
          if (active) {
            const m = await window.api.invoke("workbook:meta", active);
            if (m && !m.error) {
              setMeta(m);
              if (activeSheet) loadSheet(activeSheet, sheetRows.page);
            } else {
              console.warn("[DEBUG] Auto-refresh failed for workbook metadata");
            }
          }
        }, cfg.autoRefreshSeconds * 1000);
        return () => clearInterval(interval);
      }
    }, [config, active, activeSheet, sheetRows.page]);

    function Row({ index, style }) {
      const row = sheetRows.rows[index];
      return React.createElement(
        "tr",
        { style: style },
        (sheetRows.headers || []).map((h) =>
          React.createElement("td", { key: h }, String(row[h] ?? ""))
        ),
        React.createElement(
          "td",
          null,
          React.createElement(
            "button",
            { onClick: () => openEditModal(row) },
            "Edit"
          ),
          React.createElement(
            "button",
            { onClick: () => deleteRow(row), style: { marginLeft: 8 } },
            "Delete"
          )
        )
      );
    }

    function applyGlobalFilter(rows) {
      if (!filterText) return rows;
      const lowerFilter = filterText.toLowerCase();
      return rows.filter((row) =>
        Object.values(row).some(
          (value) =>
            value != null && String(value).toLowerCase().includes(lowerFilter)
        )
      );
    }

    return React.createElement(
      "div",
      { className: darkMode ? "dark" : "" },
      React.createElement(
        "div",
        { className: "flex h-screen" },
        React.createElement(Sidebar, {
          files: files,
          activePath: active,
          onOpen: openWorkbook,
          onRefresh: refreshFiles,
          autoRefresh: config?.autoRefreshSeconds > 0,
          onToggleAutoRefresh: () =>
            setConfig((prev) => ({
              ...prev,
              autoRefreshSeconds: prev?.autoRefreshSeconds > 0 ? 0 : 30, // toggle example
            })),
        }),
        React.createElement(
          "main",
          {
            className:
              "flex-1 p-4 bg-white dark:bg-gray-900 text-black dark:text-white",
          },
          React.createElement(
            "button",
            {
              onClick: () => setDarkMode(!darkMode),
              className: "mb-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded",
            },
            "Toggle Dark Mode"
          ),
          meta &&
            React.createElement(SheetTabs, {
              sheets: meta.sheets || [],
              active: activeSheet,
              onSelect: loadSheet,
              onReload: () => loadSheet(activeSheet),
            }),
          activeSheet &&
            React.createElement(DataGrid, {
              headers: sheetRows.headers,
              rows: sheetRows.rows,
              onEdit: (row) => openEditModal(row),
              onDelete: (row) => deleteRow(row),
              onSort: (header) => handleSort(header),
              sortKey: sortConfig.key,
              sortDirection: sortConfig.direction,
            }),
          React.createElement(CrudModal, {
            open: modal.open,
            title: modal.mode === "add" ? "Add Row" : "Edit Row",
            headers: sheetRows.headers,
            data: modal.data || {},
            errors: modal.errors || {},
            onClose: () => setModal({ open: false, mode: null, data: null }),
            onSubmit: modalSubmit,
            onChange: (header, value) =>
              setModal((prev) => ({
                ...prev,
                data: { ...prev.data, [header]: value },
              })),
          }),
          toast &&
            React.createElement(Toast, {
              message: toast,
              type: "success",
              onClose: () => setToast(null),
            })
        )
      )
    );
  }

  // Debug log to confirm global exposure
  console.log("[DEBUG] Exposing App as ExcelDBApp");
  // Attach App to the global window object
  window.ExcelDBApp = App;
})();
