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
      showToast("Row updated");
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
      showToast("Row deleted");
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
      { style: { display: "flex", height: "100vh", fontFamily: "sans-serif" } },
      // Aside: folder and files
      React.createElement(
        "aside",
        { style: { width: 320, borderRight: "1px solid #ddd", padding: 12 } },
        React.createElement("h3", null, "Workbooks"),
        React.createElement(
          "div",
          { style: { display: "flex", gap: 8, marginBottom: 12 } },
          React.createElement(
            "button",
            { onClick: pickFolder },
            folder ? "Change Folder" : "Choose Folder"
          ),
          folder &&
            React.createElement("button", { onClick: refreshFiles }, "Refresh")
        ),
        React.createElement(
          "div",
          { style: { marginTop: 12, fontSize: 12, color: "#444" } },
          folder || "No folder selected"
        ),
        React.createElement(
          "div",
          { style: { marginTop: 12 } },
          files.map((f) =>
            React.createElement(
              "div",
              {
                key: f.path,
                style: { padding: 8, borderBottom: "1px solid #eee" },
              },
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 8 } },
                React.createElement(
                  "div",
                  { style: { flex: 1 } },
                  React.createElement("strong", null, f.name)
                ),
                React.createElement(
                  "button",
                  { onClick: () => openWorkbook(f) },
                  "Open"
                )
              ),
              React.createElement(
                "div",
                { style: { fontSize: 11, color: "#666", marginTop: 4 } },
                `${Math.round(f.size / 1024)} KB • ${new Date(
                  f.mtimeMs
                ).toLocaleString()}`
              )
            )
          )
        )
      ),
      // Main
      React.createElement(
        "main",
        { style: { flex: 1, padding: 12 } },
        active
          ? React.createElement(
              "div",
              null,
              React.createElement("h2", null, `Active: ${active}`),
              meta
                ? React.createElement(
                    "div",
                    null,
                    React.createElement("h4", null, "Sheets"),
                    React.createElement(
                      "div",
                      {
                        style: {
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        },
                      },
                      (meta?.sheets || []).map((s) =>
                        React.createElement(
                          "button",
                          {
                            key: s.name,
                            onClick: () => loadSheet(s.name),
                            style: isReadOnly(s.name)
                              ? { backgroundColor: "#f5f5f5", color: "#666" }
                              : {},
                          },
                          `${s.name} (${s.rows})${
                            isReadOnly(s.name) ? " 🔒" : ""
                          }`
                        )
                      ),
                      React.createElement(
                        "div",
                        { style: { marginLeft: "auto" } },
                        activeSheet &&
                          !isReadOnly(activeSheet) &&
                          React.createElement(
                            "button",
                            { onClick: openAddModal },
                            "Add Row"
                          ),
                        React.createElement(
                          "button",
                          {
                            onClick: async () => {
                              const r = await window.api.invoke(
                                "workbook:export",
                                active
                              );
                              if (r && r.error)
                                alert(
                                  "Export failed: " +
                                    r.error +
                                    (r.message ? " - " + r.message : "")
                                );
                              else alert("Exported to: " + r.path);
                            },
                            style: { marginLeft: 8 },
                          },
                          "Export Workbook"
                        )
                      )
                    ),
                    activeSheet &&
                      React.createElement(
                        "div",
                        { style: { marginTop: 12 } },
                        React.createElement(
                          "div",
                          null,
                          React.createElement("input", {
                            placeholder: "Global filter",
                            value: filterText,
                            onChange: (e) => setFilterText(e.target.value),
                          }),
                          React.createElement(
                            "button",
                            { onClick: () => loadSheet(activeSheet, 1) },
                            "Apply"
                          )
                        ),
                        React.createElement(
                          "div",
                          { style: { marginTop: 8 } },
                          React.createElement(
                            "div",
                            { style: { overflowX: "auto" } },
                            React.createElement(
                              "table",
                              {
                                border: 1,
                                cellPadding: 6,
                                style: {
                                  borderCollapse: "collapse",
                                  width: "100%",
                                  position: "sticky",
                                  top: 0,
                                },
                              },
                              React.createElement(
                                "thead",
                                null,
                                React.createElement(
                                  "tr",
                                  null,
                                  (sheetRows.headers || []).map((h, index) =>
                                    React.createElement(
                                      "th",
                                      {
                                        key: `${h}-${index}`,
                                        style: {
                                          background: "#f9f9f9",
                                          position: "sticky",
                                          top: 0,
                                          cursor: "pointer",
                                          userSelect: "none",
                                        },
                                        onClick: () => handleSort(h),
                                      },
                                      h +
                                        (sortConfig.key === h
                                          ? sortConfig.direction === "asc"
                                            ? " ↑"
                                            : " ↓"
                                          : "")
                                    )
                                  ),
                                  React.createElement(
                                    "th",
                                    {
                                      style: {
                                        background: "#f9f9f9",
                                        position: "sticky",
                                        top: 0,
                                      },
                                    },
                                    "Actions"
                                  )
                                )
                              ),
                              React.createElement(
                                "tbody",
                                null,
                                sortRows(
                                  sheetRows.rows || [],
                                  sheetRows.headers
                                ).map((r, idx) =>
                                  React.createElement(
                                    "tr",
                                    { key: idx },
                                    (sheetRows.headers || []).map((h, colIdx) =>
                                      React.createElement(
                                        "td",
                                        { key: `${h}-${colIdx}-${idx}` },
                                        String(r[h] ?? "")
                                      )
                                    ),
                                    React.createElement(
                                      "td",
                                      null,
                                      !isReadOnly(activeSheet) &&
                                        React.createElement(
                                          "button",
                                          { onClick: () => openEditModal(r) },
                                          "Edit"
                                        ),
                                      !isReadOnly(activeSheet) &&
                                        React.createElement(
                                          "button",
                                          {
                                            onClick: () => deleteRow(r),
                                            style: { marginLeft: 8 },
                                          },
                                          "Delete"
                                        ),
                                      isReadOnly(activeSheet) &&
                                        React.createElement(
                                          "span",
                                          {
                                            style: {
                                              color: "#999",
                                              fontSize: 12,
                                            },
                                          },
                                          "Read-only"
                                        )
                                    )
                                  )
                                )
                              )
                            ),
                            React.createElement(
                              "div",
                              { style: { marginTop: 8 } },
                              React.createElement(
                                "button",
                                {
                                  disabled: sheetRows.page <= 1,
                                  onClick: () =>
                                    loadSheet(activeSheet, sheetRows.page - 1),
                                },
                                "Prev"
                              ),
                              React.createElement(
                                "span",
                                { style: { margin: "0 8px" } },
                                `Page ${sheetRows.page} / ${
                                  Math.ceil(
                                    sheetRows.total / sheetRows.pageSize
                                  ) || 1
                                }`
                              ),
                              React.createElement(
                                "button",
                                {
                                  disabled:
                                    sheetRows.page * sheetRows.pageSize >=
                                    sheetRows.total,
                                  onClick: () =>
                                    loadSheet(activeSheet, sheetRows.page + 1),
                                },
                                "Next"
                              )
                            )
                          )
                        )
                      )
                  )
                : React.createElement("div", null, "Loading workbook...")
            )
          : React.createElement("div", null, "No workbook selected")
      ),
      // Modal UI (placed at root)
      React.createElement(
        Modal,
        {
          open: modal.open,
          title: modal.mode === "add" ? "Add Row" : "Edit Row",
          onClose: () => setModal({ open: false, mode: null, data: null }),
        },
        modal.open &&
          React.createElement(
            "div",
            null,
            modal.mode === "conflict" &&
              modal.conflict &&
              modal.conflict.current
              ? React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "p",
                    null,
                    "Version conflict detected. Latest row (server):"
                  ),
                  React.createElement(
                    "pre",
                    {
                      style: {
                        background: "#f5f5f5",
                        padding: 8,
                        maxHeight: 200,
                        overflow: "auto",
                      },
                    },
                    JSON.stringify(modal.conflict.current, null, 2)
                  ),
                  React.createElement("p", null, "Your attempted changes:"),
                  React.createElement(
                    "pre",
                    {
                      style: {
                        background: "#f9f9f9",
                        padding: 8,
                        maxHeight: 200,
                        overflow: "auto",
                      },
                    },
                    JSON.stringify(modal.data, null, 2)
                  ),
                  React.createElement(
                    "div",
                    { style: { marginTop: 12, textAlign: "right" } },
                    React.createElement(
                      "button",
                      { onClick: conflictReload },
                      "Reload Latest"
                    ),
                    React.createElement(
                      "button",
                      { onClick: conflictOverwrite, style: { marginLeft: 8 } },
                      "Overwrite with my changes"
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () =>
                          setModal({
                            open: false,
                            mode: null,
                            data: null,
                            errors: null,
                            conflict: null,
                          }),
                        style: { marginLeft: 8 },
                      },
                      "Cancel"
                    )
                  )
                )
              : React.createElement(
                  "div",
                  null,
                  (sheetRows.headers || []).map((h, index) => {
                    const t = typeHintForColumn(h);
                    const value =
                      modal.data && modal.data[h] != null ? modal.data[h] : ""; // Default to empty string
                    const err = modal.errors && modal.errors[h];
                    const isRequired =
                      h &&
                      (String(h).trim().endsWith("*") ||
                        /\(required\)/i.test(String(h)));
                    if (t === "checkbox") {
                      return React.createElement(
                        "div",
                        { key: `${h}-${index}`, style: { marginBottom: 8 } },
                        React.createElement(
                          "label",
                          null,
                          h,
                          isRequired
                            ? React.createElement(
                                "span",
                                { style: { color: "red", marginLeft: 6 } },
                                "*"
                              )
                            : null,
                          " "
                        ),
                        React.createElement("input", {
                          type: "checkbox",
                          checked: !!value,
                          onChange: (e) =>
                            setModal((prev) => ({
                              ...prev,
                              data: {
                                ...prev.data,
                                [h]: e.target.checked,
                              },
                            })),
                        }),
                        err
                          ? React.createElement(
                              "div",
                              { style: { color: "red", fontSize: 12 } },
                              err
                            )
                          : null
                      );
                    }
                    return React.createElement(
                      "div",
                      { key: `${h}-${index}`, style: { marginBottom: 8 } },
                      React.createElement(
                        "label",
                        null,
                        h,
                        isRequired
                          ? React.createElement(
                              "span",
                              { style: { color: "red", marginLeft: 6 } },
                              "*"
                            )
                          : null
                      ),
                      React.createElement("input", {
                        type: "text",
                        value: value, // Ensure value defaults to empty string
                        onChange: (e) =>
                          setModal((prev) => ({
                            ...prev,
                            data: {
                              ...prev.data,
                              [h]: e.target.value,
                            },
                          })),
                        style: { width: "100%" },
                        autoFocus: (sheetRows.headers || []).indexOf(h) === 0,
                        onKeyDown: (e) => {
                          if (e.key === "Enter") modalSubmit();
                        },
                      }),
                      err
                        ? React.createElement(
                            "div",
                            { style: { color: "red", fontSize: 12 } },
                            err
                          )
                        : null
                    );
                  }),
                  // preview of normalized value
                  React.createElement(
                    "div",
                    { style: { marginTop: 8, color: "#666", fontSize: 12 } },
                    "Preview:\u00A0",
                    React.createElement(
                      "div",
                      {
                        style: {
                          fontFamily: "monospace",
                          maxHeight: 160,
                          overflow: "auto",
                          background: "#fafafa",
                          padding: 8,
                          borderRadius: 4,
                        },
                      },
                      (sheetRows.headers || []).map((hh, previewIdx) =>
                        React.createElement(
                          "div",
                          {
                            key: `${hh}-${previewIdx}`,
                            style: { marginBottom: 4 },
                          },
                          React.createElement("strong", null, hh + ": "),
                          React.createElement("span", null, getFieldPreview(hh))
                        )
                      )
                    )
                  ),
                  React.createElement(
                    "div",
                    { style: { marginTop: 12, textAlign: "right" } },
                    React.createElement(
                      "button",
                      {
                        onClick: () =>
                          setModal({
                            open: false,
                            mode: null,
                            data: null,
                            errors: null,
                            conflict: null,
                          }),
                      },
                      "Cancel"
                    ),
                    React.createElement(
                      "button",
                      {
                        onClick: () => {
                          if (modal.mode === "add") submitAdd(modal.data);
                          else submitEdit(modal.data);
                        },
                        style: { marginLeft: 8 },
                      },
                      "Submit"
                    )
                  )
                )
          )
      ),
      // Toast element
      toast
        ? React.createElement(
            "div",
            {
              style: {
                position: "fixed",
                right: 20,
                bottom: 20,
                background: "rgba(0,0,0,0.8)",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 13,
              },
            },
            toast
          )
        : null
    );
  }

  // Debug log to confirm global exposure
  console.log("[DEBUG] Exposing App as ExcelDBApp");
  // Attach App to the global window object
  window.ExcelDBApp = App;
})();
