import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Edit3, Plus, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { crudPolicyFor, detectPkField, type CrudPolicy } from "../utils/model";
import { inferShape, isScalar, preview } from "../utils/shape";
import CrudModal from "./CrudModal";
import InlineEditableScalar from "./InlineEditableScalar";

function pathJoin(parent: string | undefined, key: string | number) {
  if (!parent) return String(key);
  return typeof key === "number" ? `${parent}[${key}]` : `${parent}.${key}`;
}

/* ---------- Tabs ---------- */
function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 px-2 py-1 rounded-t-lg">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 ${
            value === t
              ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500 shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50"
          }`}>
          {t}
        </button>
      ))}
    </div>
  );
}

/* ---------- MAIN ---------- */
export default function JsonColumnExpand({
  data,
  rootKey,
  tabOrder,
  maxTopCols = 50,
  maxNestedCols = 50,
  // CRUD handlers (optional)
  filePath,
  canEditScalar,
  onEditScalar,
  onCreateRow,
  onDeleteRow,
  onEditRow,
}: {
  data: any;
  rootKey?: string; // e.g. "data"
  tabOrder?: string[]; // enforce top-level tab order
  maxTopCols?: number; // cap for wide top-level arrays/objects
  maxNestedCols?: number; // cap for nested tables
  filePath?: string;
  canEditScalar?: (path: string, value: any) => boolean;
  onEditScalar?: (path: string, next: any) => void;
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, pkValue: any) => void;
  onEditRow?: (
    path: string,
    field: string,
    newValue: any,
    oldValue: any,
    pkValue: any
  ) => void;
  onOpenEditRowModal?: (tablePath: string, row: any) => void;
}) {
  // Schema state for CRUD analysis (mirrors InfoView)
  const [schema, setSchema] = useState<any | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  // Modal state for per-row edit/add
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<
    "edit" | "add" | "conflict" | null
  >(null);
  const [modalData, setModalData] = useState<Record<string, any> | null>(null);
  const [modalHeaders, setModalHeaders] = useState<string[]>([]);
  const [modalErrors, setModalErrors] = useState<Record<string, string> | null>(
    null
  );
  const [modalConflict, setModalConflict] = useState<any | null>(null);

  // Debug: log available CRUD handlers
  useEffect(() => {
    console.log("JsonHierarchicalViewer CRUD handlers:", {
      onCreateRow: !!onCreateRow,
      onDeleteRow: !!onDeleteRow,
      onEditRow: !!onEditRow,
      onEditScalar: !!onEditScalar,
    });
  }, [onCreateRow, onDeleteRow, onEditRow, onEditScalar]);

  // Load JSON schema for CRUD analysis when filePath changes
  useEffect(() => {
    if (!filePath) return;
    setLoadingSchema(true);
    console.log("🔍 Loading JSON schema for:", filePath);
    (window as any).api.json
      .getSchema(filePath)
      .then((result: any) => {
        console.log("📋 Schema analysis result:", result);
        setSchema(result);
        const crudTables = Object.entries(result.byPath || {}).filter(
          ([, info]) => (info as any).allowCrud
        );
        if (crudTables.length > 0) {
          console.log(
            `✅ JSON CRUD: Found ${crudTables.length} editable table(s):`,
            crudTables.map(
              ([path, info]) =>
                `${path} (${(info as any).itemCount} rows, PK: ${
                  (info as any).pkField
                })`
            )
          );
        } else {
          console.log(
            "ℹ️ JSON CRUD: No editable tables found (need arrays of objects with scalar values and natural primary keys)"
          );
        }
      })
      .catch((err: any) => {
        console.error("Failed to load JSON schema:", err);
      })
      .finally(() => setLoadingSchema(false));
  }, [filePath]);

  // Helper to get value at path (dot/array index syntax)
  function getValueAtPath(obj: any, path: string): any {
    if (!path) return obj;
    const parts = path.split(/[[\].]+|\.+/).filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      const idx = isNaN(Number(part)) ? part : Number(part);
      current = current[idx];
    }
    return current;
  }

  // Enhanced edit scalar handler (calls backend when filePath provided)
  const handleEditScalar = useCallback(
    async (path: string, newValue: any) => {
      if (!filePath) {
        onEditScalar?.(path, newValue);
        return;
      }

      try {
        const oldValue = getValueAtPath(data, path);
        const result = await (window as any).api.json.updateScalar(
          filePath,
          path,
          newValue,
          oldValue
        );

        if (result.error) {
          console.error("Failed to update scalar:", result.error);
          alert(`Failed to update: ${result.error}`);
          return;
        }

        if (result.conflict) {
          const confirmUpdate = confirm(
            `Conflict detected! The value has been changed to "${result.current}". Do you want to overwrite it with "${newValue}"?`
          );
          if (confirmUpdate) {
            const retryResult = await (window as any).api.json.updateScalar(
              filePath,
              path,
              newValue,
              result.current
            );
            if (retryResult.error) {
              alert(
                `Failed to update after conflict resolution: ${retryResult.error}`
              );
              return;
            }
          } else {
            return;
          }
        }

        onEditScalar?.(path, newValue);
      } catch (err: any) {
        console.error("Failed to update scalar:", err);
        alert(`Failed to update: ${err.message || "Unknown error"}`);
      }
    },
    [filePath, data, onEditScalar]
  );

  // Helper: open edit modal for a given row object and tablePath
  function openEditRowModal(tablePath: string, row: any) {
    const tableInfo = schema?.byPath?.[tablePath];
    const headers = tableInfo?.columns || Object.keys(row || {});
    setModalHeaders(headers);
    setModalData({ ...(row || {}) });
    setModalErrors(null);
    setModalConflict(null);
    setModalMode("edit");
    setModalOpen(true);
  }

  // Helper: submit modal changes (edit mode)
  async function submitModal() {
    if (!modalMode || !modalData) return;
    if (modalMode === "edit") {
      // compute changed keys between modalData and original data snapshot in file
      // We need tablePath and pk to locate the row in the underlying data. We'll rely on modalData containing pk.
      // Find a tablePath from schema that matches modalHeaders context: try to pick the one where modalData has pkField
      // For simplicity, assume the last-opened cell's basePath is stored in modalData.__tablePath
      const tablePath = (modalData as any).__tablePath as string | undefined;
      const tableInfo = tablePath ? schema?.byPath?.[tablePath] : null;
      const pkField = tableInfo?.pkField;

      // Find original row object within the live data array if possible
      let originalRow: any = null;
      let rowIndex: number | null = null;
      if (tablePath && pkField) {
        const arr = getValueAtPath(data, tablePath) as any[] | undefined;
        if (Array.isArray(arr)) {
          const pkValue = (modalData as any)[pkField];
          const found = arr.findIndex((r) => r && r[pkField] === pkValue);
          if (found >= 0) {
            rowIndex = found;
            originalRow = arr[found];
          }
        }
      }

      // If onEditRow handler provided, call it per-diff; otherwise fallback to api.json.updateScalar per-field
      const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];
      const headers = modalHeaders.length
        ? modalHeaders
        : Object.keys(modalData || {});
      for (const h of headers) {
        const oldV = originalRow ? originalRow[h] : undefined;
        const newV = (modalData as any)[h];
        if (String(oldV) !== String(newV)) {
          changes.push({ field: h, oldVal: oldV, newVal: newV });
        }
      }

      try {
        if (changes.length === 0) {
          setModalOpen(false);
          return;
        }

        for (const ch of changes) {
          if (onEditRow && tablePath) {
            // prefer calling parent handler
            const pkValue = pkField
              ? (modalData as any)[pkField]
              : rowIndex ?? undefined;
            onEditRow(tablePath, ch.field, ch.newVal, ch.oldVal, pkValue);
          } else if (filePath && tablePath && rowIndex != null) {
            // fallback: call backend updateScalar for the specific field path
            const fieldPath = `${tablePath}[${rowIndex}].${ch.field}`;
            const oldValue = ch.oldVal;
            const res = await (window as any).api.json.updateScalar(
              filePath,
              fieldPath,
              ch.newVal,
              oldValue
            );
            if (res?.error) {
              setModalErrors({ [ch.field]: String(res.error) });
              return;
            }
            if (res?.conflict) {
              setModalConflict(res.current);
              setModalMode("conflict");
              return;
            }
          }
        }

        setModalOpen(false);
      } catch (err: any) {
        setModalErrors({ _global: err?.message || String(err) });
      }
    }
  }
  // If a rootKey is provided but missing in the payload, fall back to the top-level
  // data so we can render files that aren't wrapped under a "data" property.
  const root = rootKey ? data?.[rootKey] ?? data : data;

  const tabs = useMemo(() => {
    if (!root || typeof root !== "object" || Array.isArray(root))
      return ["value"];
    const keys = Object.keys(root);
    if (tabOrder?.length) {
      const set = new Set(tabOrder);
      return [
        ...tabOrder.filter((k) => keys.includes(k)),
        ...keys.filter((k) => !set.has(k)),
      ];
    }
    return keys;
  }, [root, tabOrder]);

  const [active, setActive] = useState(tabs[0] ?? "value");
  const current = useMemo(
    () =>
      tabs.length === 1 && tabs[0] === "value" ? root : (root as any)?.[active],
    [root, tabs, active]
  );

  // path for the currently active tab/node
  const rootPath = useMemo(() => {
    // If rootKey was provided but not present, don't include it in the path.
    const usingTop = rootKey ? Boolean(data && !data[rootKey]) : false;
    if (!rootKey || usingTop) return active === "value" ? "" : active;
    return `${rootKey}.${active}`;
  }, [rootKey, active, data]);

  const shape = useMemo(
    () => inferShape(current, rootPath || ""),
    [current, rootPath]
  );
  const policy = useMemo(() => crudPolicyFor(current, shape), [current, shape]);

  // Loading state
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:to-gray-900 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading JSON data...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!root || (typeof root === "object" && Object.keys(root).length === 0)) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:to-gray-900 rounded-lg">
        <div className="text-center">
          <div className="text-4xl mb-4">📄</div>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No data available
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            The JSON file appears to be empty or invalid
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
      <Tabs tabs={tabs} value={active} onChange={setActive} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <ColumnExpandableTable
          value={current}
          level={0}
          colCap={maxTopCols}
          nestedColCap={maxNestedCols}
          basePath={rootPath}
          schema={schema}
          onEditScalar={handleEditScalar}
          onCreateRow={onCreateRow}
          onDeleteRow={onDeleteRow}
          onEditRow={onEditRow}
          onOpenEditRowModal={openEditRowModal}
        />
      </div>
      {/** Edit/Add modal */}
      <CrudModal
        open={modalOpen}
        mode={(modalMode as any) || undefined}
        conflict={modalConflict}
        title={
          modalMode === "add"
            ? "Add Row"
            : modalMode === "edit"
            ? "Edit Row"
            : ""
        }
        headers={modalHeaders}
        data={modalData || {}}
        errors={modalErrors || {}}
        onClose={() => setModalOpen(false)}
        onSubmit={() => submitModal()}
        onChange={(header: string, value: any) =>
          setModalData((prev) => ({ ...(prev || {}), [header]: value }))
        }
        onResolve={(action: string) => {
          if (action === "reload") {
            setModalOpen(false);
            setModalConflict(null);
            setModalMode(null);
          } else if (action === "overwrite") {
            // If conflict resolution is requested, attempt to overwrite by retrying submitModal with conflict resolution
            // For simplicity just close modal and clear conflict; more sophisticated behavior can be added.
            setModalOpen(false);
            setModalConflict(null);
            setModalMode(null);
          }
        }}
      />
    </div>
  );
}

/* ---------- Column-expandable table ---------- */
/* Renders one logical "row". Columns represent either array indices or object keys.
   Clicking a column HEADER toggles inline expansion; the cell under that header shows a nested table. */

function ColumnExpandableTable({
  value,
  level,
  colCap,
  nestedColCap,
  basePath,
  onEditScalar,
  schema,
  onCreateRow,
  onDeleteRow,
  onEditRow,
  onOpenEditRowModal,
}: {
  value: any;
  level: number;
  colCap: number;
  nestedColCap: number;
  basePath?: string;
  onEditScalar?: (path: string, next: any) => void;
  schema?: any | null;
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, pkValue: any) => void;
  onEditRow?: (
    path: string,
    field: string,
    newValue: any,
    oldValue: any,
    pkValue: any
  ) => void;
  onOpenEditRowModal?: (tablePath: string, row: any) => void;
}) {
  const [openCols, setOpenCols] = useState<Record<string, boolean>>({});

  // 1) Build columns for ARRAY (indices) or OBJECT (keys)
  const { columns, singleRow, restBadge } = useMemo(() => {
    const cols: ColumnDef<any>[] = [];

    if (Array.isArray(value)) {
      const indices = value.map((_, i) => String(i)).slice(0, colCap);
      indices.forEach((indexStr, idxNum) => {
        const headerId = indexStr;
        const nestedVal = value[idxNum];
        cols.push({
          id: headerId,
          header: () => {
            const tableInfo = schema?.byPath?.[basePath || ""];
            const pkField = tableInfo?.pkField;
            const pkValue = pkField ? nestedVal?.[pkField] : undefined;
            const allowCrud = tableInfo?.allowCrud;
            return (
              <div className="flex items-start justify-between gap-2">
                <HeaderExpander
                  title={indexStr}
                  summary={preview(nestedVal)}
                  open={!!openCols[headerId]}
                  toggle={() => {
                    setOpenCols((s) => ({ ...s, [headerId]: !s[headerId] }));
                  }}
                />
                {allowCrud && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!onDeleteRow) return;
                      // call delete with table basePath and pk value
                      onDeleteRow(String(basePath || ""), pkValue);
                    }}
                    title={
                      pkField ? `Delete row (pk: ${pkValue})` : "Delete row"
                    }
                    className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded">
                    🗑
                  </button>
                )}
              </div>
            );
          },
          cell: () =>
            openCols[headerId] ? (
              <CellNest>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <RenderNested
                      value={nestedVal}
                      level={level + 1}
                      colCap={nestedColCap}
                      nestedColCap={nestedColCap}
                      basePath={pathJoin(basePath, idxNum)}
                      onEditScalar={onEditScalar}
                      schema={schema}
                      onCreateRow={onCreateRow}
                      onDeleteRow={onDeleteRow}
                      onEditRow={onEditRow}
                      onOpenEditRowModal={onOpenEditRowModal}
                    />
                  </div>
                  {schema?.byPath?.[basePath || ""]?.allowCrud && (
                    <div className="flex flex-col gap-2 items-center">
                      <button
                        onClick={() => {
                          // open edit modal for this row via handler passed from parent
                          onOpenEditRowModal?.(
                            String(basePath || ""),
                            nestedVal
                          );
                        }}
                        className="p-1 text-gray-700 hover:text-gray-900 bg-gray-100 rounded">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const tbl = String(basePath || "");
                          const pk = schema?.byPath?.[tbl]?.pkField;
                          const pkValue = pk ? nestedVal?.[pk] : undefined;
                          onDeleteRow?.(tbl, pkValue);
                        }}
                        className="p-1 text-red-600 hover:text-red-800 bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </CellNest>
            ) : (
              <span className="text-gray-400 dark:text-gray-500 italic text-sm">
                {/* collapsed */}
              </span>
            ),
        });
      });

      // overflow badge
      const overflow = value.length - indices.length;
      // If this array is an array-of-objects and schema says allowCrud, expose an Actions column
      const tableInfo = schema?.byPath?.[basePath || ""];
      const showActions = tableInfo?.allowCrud;
      if (showActions) {
        cols.push({
          id: "__actions",
          header: () => (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => onCreateRow?.(String(basePath || ""))}
                className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                ➕ Add
              </button>
            </div>
          ),
          cell: () => (
            <div className="text-right text-sm text-gray-600">&nbsp;</div>
          ),
        });
      }
      return {
        columns: cols,
        singleRow: [{}],
        restBadge: overflow > 0 ? `+${overflow}` : "",
      };
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      // Render objects as individual key-value pairs, not as table rows
      const keys = Object.keys(value);
      const scalarKeys = keys.filter((k) => {
        const v = (value as any)[k];
        return v == null || typeof v !== "object";
      });
      const nestedKeys = keys.filter((k) => !scalarKeys.includes(k));

      const headers = [...scalarKeys, ...nestedKeys].slice(0, colCap);

      headers.forEach((k) => {
        const v = (value as any)[k];
        const headerId = k;
        const isNested = !(v == null || typeof v !== "object");

        cols.push({
          id: headerId,
          header: () => (
            <div className="font-medium text-gray-700 dark:text-gray-300 text-sm">
              {k}
            </div>
          ),
          cell: () => {
            if (!isNested) {
              // scalar → plain value
              const cellPath = pathJoin(basePath, headerId);
              const fieldShape = inferShape(v, cellPath);
              const fieldPolicy = crudPolicyFor(v, fieldShape);
              const editable =
                !!onEditScalar && isScalar(v) && !!fieldPolicy.editable;
              return (
                <InlineEditableScalar
                  value={v}
                  path={cellPath}
                  editable={editable}
                  onCommit={onEditScalar}
                />
              );
            }
            // nested → render nested value with expand/collapse
            return (
              <div>
                <button
                  onClick={() =>
                    setOpenCols((s) => ({ ...s, [headerId]: !s[headerId] }))
                  }
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  {openCols[headerId] ? "▼" : "▶"}
                  {Array.isArray(v) ? `[${v.length}]` : "{…}"}
                </button>
                {openCols[headerId] && (
                  <div className="mt-2">
                    <RenderNested
                      value={v}
                      level={level + 1}
                      colCap={nestedColCap}
                      nestedColCap={nestedColCap}
                      basePath={pathJoin(basePath, headerId)}
                      onEditScalar={onEditScalar}
                      schema={schema}
                      onCreateRow={onCreateRow}
                      onDeleteRow={onDeleteRow}
                      onEditRow={onEditRow}
                      onOpenEditRowModal={onOpenEditRowModal}
                    />
                  </div>
                )}
              </div>
            );
          },
        });
      });

      const overflow = keys.length - headers.length;
      return {
        columns: cols,
        singleRow: [{}], // Empty row - data is in columns only
        restBadge: overflow > 0 ? `+${overflow}` : "",
      };
    }

    // Scalar → render a single column "value"
    cols.push({
      id: "value",
      header: "value",
      cell: () => (
        <span className="text-gray-700 dark:text-gray-300 text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {preview(value)}
        </span>
      ),
    });
    return { columns: cols, singleRow: [{}], restBadge: "" };
  }, [value, colCap, nestedColCap, openCols, level]);

  const table = useReactTable({
    data: singleRow,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Empty state for no columns
  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="text-3xl mb-3">🔍</div>
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            No data to display
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            This section appears to be empty
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${
        level === 0
          ? "border border-gray-200 dark:border-gray-700 shadow-sm"
          : "border border-dashed border-gray-300 dark:border-gray-600"
      } rounded-lg overflow-hidden bg-white dark:bg-gray-800`}>
      <div
        className="overflow-auto max-h-full custom-scrollbar"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#3b82f6 #dbeafe",
          maxHeight: level === 0 ? "60vh" : "40vh",
        }}>
        <table
          className="w-full border-collapse"
          style={{ tableLayout: "auto" }}>
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2 text-left text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 transition-all duration-200"
                    style={{
                      whiteSpace: "nowrap",
                      minWidth: "120px",
                      width: "auto",
                    }}>
                    <div className="pointer-events-auto w-full">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </div>
                  </th>
                ))}
                {restBadge && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700">
                    {restBadge}
                  </th>
                )}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-900">
            {table.getRowModel().rows.map((r, index) => (
              <tr
                key={r.id}
                className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                style={{ animationDelay: `${index * 50}ms` }}>
                {r.getVisibleCells().map((c) => (
                  <td
                    key={c.id}
                    className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                    style={{
                      verticalAlign: "top",
                      width: "auto",
                      minWidth: "120px",
                    }}>
                    <div className="w-full">
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </div>
                  </td>
                ))}
                {restBadge && <td className="px-3 py-2" />}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// InlineEditableScalar was moved to its own component file

/* ---------- Inline nested renderer ---------- */
function RenderNested({
  value,
  level,
  colCap,
  nestedColCap,
  basePath,
  onEditScalar,
  schema,
  onCreateRow,
  onDeleteRow,
  onEditRow,
  onOpenEditRowModal,
}: {
  value: any;
  level: number;
  colCap: number;
  nestedColCap: number;
  basePath?: string;
  onEditScalar?: (path: string, next: any) => void;
  schema?: any | null;
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, pkValue: any) => void;
  onEditRow?: (
    path: string,
    field: string,
    newValue: any,
    oldValue: any,
    pkValue: any
  ) => void;
  onOpenEditRowModal?: (tablePath: string, row: any) => void;
}) {
  // Note: we will forward onOpenEditRowModal into ColumnExpandableTable when rendering nested arrays/objects

  // If nested value is array/object, recurse with ColumnExpandableTable
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return (
      <ColumnExpandableTable
        value={value}
        level={level}
        colCap={colCap}
        nestedColCap={nestedColCap}
        basePath={basePath}
        onEditScalar={onEditScalar}
        schema={schema}
        onCreateRow={onCreateRow}
        onDeleteRow={onDeleteRow}
        onEditRow={onEditRow}
        onOpenEditRowModal={onOpenEditRowModal}
      />
    );
  }
  return (
    <div>
      {(() => {
        const cellPath = basePath || "";
        const fieldShape = inferShape(value, cellPath);
        const fieldPolicy = crudPolicyFor(value, fieldShape);
        const editable =
          !!onEditScalar && isScalar(value) && !!fieldPolicy.editable;
        return (
          <InlineEditableScalar
            value={value}
            path={cellPath}
            editable={editable}
            onCommit={onEditScalar}
          />
        );
      })()}
    </div>
  );
}

/* ---------- header & cell wrappers ---------- */
function HeaderExpander({
  title,
  summary,
  open,
  toggle,
  disabled,
}: {
  title: string;
  summary: string;
  open: boolean;
  toggle?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle?.();
        }}
        disabled={!toggle || disabled}
        className={`group flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 w-full text-left pointer-events-auto ${
          toggle && !disabled
            ? "hover:bg-blue-200/50 dark:hover:bg-blue-700/50 cursor-pointer"
            : "cursor-default opacity-60"
        }`}
        title={summary}
        style={{ minHeight: "24px" }}>
        <span className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
          {title}
        </span>
        {toggle && !disabled && (
          <span
            className={`text-blue-600 dark:text-blue-400 transition-transform duration-200 ${
              open ? "rotate-0" : "-rotate-90"
            }`}>
            ▼
          </span>
        )}
      </button>
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {summary}
      </span>
    </div>
  );
}

function CellNest({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-gray-700/30 transition-all duration-200 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 w-full min-w-0 overflow-hidden">
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}
