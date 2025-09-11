import { Plus, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

/** ---------- tiny utils ---------- */
const isScalar = (v: any) => v == null || typeof v !== "object";
const short = (v: any) =>
  v == null
    ? ""
    : Array.isArray(v)
    ? `[${v.length}]`
    : typeof v === "object"
    ? "{…}"
    : String(v);

function pathJoin(parent: string, key: string | number) {
  if (!parent) return String(key);
  return typeof key === "number" ? `${parent}[${key}]` : `${parent}.${key}`;
}

// Types for schema analysis
interface JsonSchema {
  byPath: Record<
    string,
    {
      type: "arrayOfObjects";
      columns: string[];
      isLeaf: boolean;
      pkField: string | null;
      allowCrud: boolean;
      itemCount: number;
    }
  >;
}

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

function EditableScalar({
  value,
  readOnly = true,
  onCommit,
}: {
  value: any;
  readOnly?: boolean;
  onCommit?: (next: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(value ?? "");

  if (readOnly || !onCommit) {
    return (
      <div className="text-center">
        {value == null || value === "" ? (
          <span className="text-gray-400 dark:text-gray-500 italic">—</span>
        ) : (
          <span className="text-gray-900 dark:text-gray-100">
            {String(value)}
          </span>
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <div
        onDoubleClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        title="Double-click to edit"
        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors duration-150 text-center min-h-[24px] flex items-center justify-center">
        {value == null || value === "" ? (
          <span className="text-gray-400 dark:text-gray-500 italic">—</span>
        ) : (
          <span className="break-words">{String(value)}</span>
        )}
      </div>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit?.(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (draft !== value) onCommit?.(draft);
        }
        if (e.key === "Escape") setEditing(false);
      }}
      className="border border-blue-300 dark:border-blue-600 rounded px-2 py-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
    />
  );
}

function Nest({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 p-4 border border-dashed border-blue-200 dark:border-blue-700 rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
      {children}
    </div>
  );
}

/** ---------- InfoView (tabs = top-level keys) ---------- */
export default function InfoView({
  data,
  rootKey = "data",
  filePath,
  canEditScalar,
  onEditScalar,
  onCreateRow,
  onDeleteRow,
  onEditRow,
  maxCols = 50,
  maxRows = 500,
}: {
  data: any;
  rootKey?: string;
  filePath?: string;
  canEditScalar?: (path: string, value: unknown) => boolean;
  onEditScalar?: (path: string, next: any) => Promise<void> | void;
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, rowId: string | number) => void;
  onEditRow?: (
    path: string,
    field: string,
    newValue: any,
    oldValue: any,
    pkValue: any
  ) => void;
  maxCols?: number;
  maxRows?: number;
}) {
  const root = rootKey ? data?.[rootKey] : data;
  const [schema, setSchema] = useState<JsonSchema | null>(null);
  const [loading, setLoading] = useState(false);

  // Debug: Log CRUD handlers availability
  console.log("InfoView CRUD handlers:", {
    onCreateRow: !!onCreateRow,
    onDeleteRow: !!onDeleteRow,
    onEditRow: !!onEditRow,
    onEditScalar: !!onEditScalar,
  });

  // Load JSON schema for CRUD analysis
  useEffect(() => {
    if (!filePath) return;

    setLoading(true);
    console.log(
      "🔍 Loading JSON schema for InfoView:",
      filePath,
      "- Data changed, refreshing schema"
    );
    (window as any).api.json
      .getSchema(filePath)
      .then((result: JsonSchema) => {
        console.log("📋 InfoView Schema analysis result:", result);
        setSchema(result);

        // Count CRUD-enabled tables
        const crudTables = Object.entries(result.byPath).filter(
          ([_, info]) => info.allowCrud
        );
        if (crudTables.length > 0) {
          console.log(
            `✅ InfoView JSON CRUD: Found ${crudTables.length} editable table(s):`,
            crudTables.map(
              ([path, info]) =>
                `${path} (${info.itemCount} rows, PK: ${info.pkField})`
            )
          );
        }
      })
      .catch((err: any) => {
        console.error("Failed to load JSON schema:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [filePath, data]); // Added 'data' dependency to refresh schema when data changes

  // Enhanced CRUD handlers
  const handleEditScalar = useCallback(
    async (path: string, newValue: unknown) => {
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
            // Retry with current value as oldValue
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

  const checkCanEdit = useCallback(
    (path: string, value: unknown) => {
      if (canEditScalar) return canEditScalar(path, value);
      if (!filePath) return false;

      // Allow editing scalars in CRUD-enabled tables or any scalar value
      return isScalar(value);
    },
    [canEditScalar, filePath]
  );

  // Helper to get value at path
  function getValueAtPath(obj: any, path: string): any {
    if (!path) return obj;
    const parts = path.split(/[\.\[\]]+/).filter(Boolean);
    let current = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[isNaN(Number(part)) ? part : Number(part)];
    }
    return current;
  }

  const tabs = useMemo(() => {
    if (!root || typeof root !== "object" || Array.isArray(root))
      return ["(value)"];
    return Object.keys(root);
  }, [root]);

  const [active, setActive] = useState(tabs[0]);

  const activeValue = useMemo(() => {
    if (tabs.length === 1 && tabs[0] === "(value)") return root;
    return (root as any)?.[active];
  }, [root, tabs, active]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
      {loading && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            Analyzing JSON structure for CRUD capabilities...
          </div>
        </div>
      )}
      <Tabs tabs={tabs} value={active} onChange={setActive} />
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <InfoLevel
          value={activeValue}
          path={rootKey ? `${rootKey}.${active}` : active}
          filePath={filePath || ""}
          schema={schema}
          canEditScalar={checkCanEdit}
          onEditScalar={handleEditScalar}
          onCreateRow={onCreateRow}
          onDeleteRow={onDeleteRow}
          onEditRow={onEditRow}
          maxCols={maxCols}
          maxRows={maxRows}
        />
      </div>
    </div>
  );
}

/**
 * InfoLevel — shows only "current level data":
 * - Object: table with ONLY scalar fields (Key | Value | Actions | Expand)
 *           Expand reveals list of nested keys (arrays/objects) as a grid of next-level keys.
 * - Array of objects: columns = union of SCALAR keys only (+ Actions + Expand col)
 *           Each row has an expand button; expansion shows the next-level keys that are arrays/objects for THAT row.
 * - Array of scalars: simple (# | value)
 * - Scalar: single cell
 */
function InfoLevel({
  value,
  path,
  filePath,
  schema,
  canEditScalar,
  onEditScalar,
  onCreateRow,
  onDeleteRow,
  onEditRow,
  maxCols,
  maxRows,
}: {
  value: any;
  path: string;
  filePath: string;
  schema?: JsonSchema | null;
  canEditScalar?: (path: string, value: unknown) => boolean;
  onEditScalar?: (path: string, next: any) => Promise<void> | void;
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, rowId: string | number) => void;
  onEditRow?: (
    path: string,
    field: string,
    newValue: any,
    oldValue: any,
    pkValue: any
  ) => void;
  maxCols: number;
  maxRows: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  /** OBJECT — current-level table = scalar keys only */
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const allKeys = Object.keys(value);
    const scalarKeys = allKeys
      .filter((k) => isScalar((value as any)[k]))
      .slice(0, maxCols);
    const nestedKeys = allKeys.filter((k) => !scalarKeys.includes(k)); // arrays/objects

    // If this object has only scalar keys, show it as a single-row table with keys as columns
    if (scalarKeys.length > 0 && nestedKeys.length === 0) {
      return (
        <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg overflow-hidden bg-white dark:bg-gray-800">
          <div
            className="overflow-auto max-h-full custom-scrollbar"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#3b82f6 #dbeafe",
              maxHeight: "60vh",
            }}>
            <table
              className="w-full border-collapse text-sm"
              style={{ tableLayout: "auto" }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                  {scalarKeys.map((k) => (
                    <th
                      key={k}
                      className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200 whitespace-nowrap">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200">
                  {scalarKeys.map((k) => {
                    const v = (value as any)[k];
                    const cellPath = pathJoin(path, k);
                    return (
                      <td
                        key={k}
                        className="px-2 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30 text-center align-middle"
                        style={{
                          maxWidth: "150px",
                          wordWrap: "break-word",
                          whiteSpace: "normal",
                          lineHeight: "1.4",
                        }}>
                        <div className="flex items-center justify-center min-h-[20px]">
                          <EditableScalar
                            value={v}
                            readOnly={!canEditScalar?.(cellPath, v)}
                            onCommit={(next) => onEditScalar?.(cellPath, next)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Mixed object (has both scalar and nested keys) - show as Key/Value table with expand for nested
    return (
      <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <div
          className="overflow-auto max-h-full custom-scrollbar"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#3b82f6 #dbeafe",
            maxHeight: "60vh",
          }}>
          <table
            className="w-full border-collapse text-sm"
            style={{ tableLayout: "auto" }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                  style={{ width: "140px" }}>
                  Key
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200">
                  Value
                </th>
                <th
                  className="px-1 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                  style={{ width: "50px" }}>
                  Actions
                </th>
                <th
                  className="px-1 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 select-none transition-all duration-200"
                  style={{ width: "40px" }}>
                  Expand
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {scalarKeys.length === 0 && nestedKeys.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-gray-500 dark:text-gray-400 italic">
                    Empty object.
                  </td>
                </tr>
              )}
              {scalarKeys.map((k, index) => {
                const v = (value as any)[k];
                const rowPath = pathJoin(path, k);
                return (
                  <tr
                    key={k}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                    style={{ animationDelay: `${index * 50}ms` }}>
                    <td
                      className="px-2 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30 text-center align-middle"
                      style={{
                        maxWidth: "140px",
                        wordWrap: "break-word",
                        whiteSpace: "normal",
                        lineHeight: "1.4",
                      }}>
                      <div className="flex items-center justify-center min-h-[20px]">
                        <strong>{k}</strong>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30 text-center align-middle"
                      style={{
                        maxWidth: "150px",
                        wordWrap: "break-word",
                        whiteSpace: "normal",
                        lineHeight: "1.4",
                      }}>
                      <div className="flex items-center justify-center min-h-[20px]">
                        <EditableScalar
                          value={v}
                          readOnly={!canEditScalar?.(rowPath, v)}
                          onCommit={(next) => onEditScalar?.(rowPath, next)}
                        />
                      </div>
                    </td>
                    <td className="px-1 py-3 text-center text-sm text-gray-500 dark:text-gray-400 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                      <span className="italic">—</span>
                    </td>
                    <td className="px-1 py-3 text-center border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                      {/* No expand for scalar-only rows */}
                    </td>
                  </tr>
                );
              })}
              {nestedKeys.map((k, index) => {
                const v = (value as any)[k];
                const rowKey = k;
                const isOpen = !!open[rowKey];
                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                      style={{
                        animationDelay: `${(scalarKeys.length + index) * 50}ms`,
                      }}>
                      <td
                        className="px-2 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30 text-center align-middle"
                        style={{
                          maxWidth: "140px",
                          wordWrap: "break-word",
                          whiteSpace: "normal",
                          lineHeight: "1.4",
                        }}>
                        <div className="flex items-center justify-center min-h-[20px]">
                          <strong>{k}</strong>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30 text-center align-middle"
                        style={{
                          maxWidth: "150px",
                          wordWrap: "break-word",
                          whiteSpace: "normal",
                          lineHeight: "1.4",
                        }}>
                        <div className="flex items-center justify-center min-h-[20px]">
                          <span className="italic">{short(v)}</span>
                        </div>
                      </td>
                      <td className="px-1 py-3 text-center text-sm text-gray-500 dark:text-gray-400 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                        <span className="italic">—</span>
                      </td>
                      <td className="px-1 py-3 text-center border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                        <button
                          onClick={() =>
                            setOpen((s) => ({ ...s, [rowKey]: !s[rowKey] }))
                          }
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors duration-150 text-sm font-mono">
                          {isOpen ? "▾" : "▸"}
                        </button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-2 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-blue-200/50 dark:border-gray-700">
                          <Nest>
                            <NextLevelKeys
                              host={value}
                              keys={[k]}
                              path={path}
                              filePath={filePath}
                              schema={schema}
                              canEditScalar={canEditScalar}
                              onEditScalar={onEditScalar}
                              onCreateRow={onCreateRow}
                              onDeleteRow={onDeleteRow}
                              onEditRow={onEditRow}
                              maxCols={maxCols}
                              maxRows={maxRows}
                            />
                          </Nest>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /** ARRAY */
  if (Array.isArray(value)) {
    const arr = value.slice(0, maxRows);
    if (arr.length === 0) {
      return (
        <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-6 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-center min-h-[100px]">
            <span className="text-gray-500 dark:text-gray-400 italic">
              Empty array
            </span>
          </div>
        </div>
      );
    }

    // Array of objects? → show SCALAR columns only + actions + expand (per row)
    const allObjects = arr.every(
      (x) => x && typeof x === "object" && !Array.isArray(x)
    );
    if (allObjects) {
      // union of keys, but we will display only scalar keys as columns
      const keySet = new Set<string>();
      for (const o of arr.slice(0, maxCols))
        for (const k of Object.keys(o)) keySet.add(k);
      const allCols = [...keySet];
      const scalarCols = allCols.filter((c) =>
        arr.some((o: any) => isScalar(o?.[c]))
      ); // keep columns that are scalar in at least one row
      const nestedCols = allCols.filter((c) => !scalarCols.includes(c));

      return (
        <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg overflow-hidden bg-white dark:bg-gray-800">
          <div
            className="overflow-auto max-h-full custom-scrollbar"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#3b82f6 #dbeafe",
              maxHeight: "60vh",
            }}>
            <table
              className="w-full border-collapse text-sm"
              style={{ tableLayout: "auto" }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                  <th
                    className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                    style={{ width: "40px" }}>
                    #
                  </th>
                  {scalarCols.map((c) => (
                    <th
                      key={c}
                      className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th
                    className="px-1 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                    style={{ width: "50px" }}>
                    Actions
                  </th>
                  <th
                    className="px-1 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 select-none transition-all duration-200"
                    style={{ width: "40px" }}>
                    Expand
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {arr.map((row: any, idx: number) => {
                  const rowKey = `r${idx}`;
                  const isOpen = !!open[rowKey];
                  const nestedKeys = nestedCols.filter((c) => row?.[c] != null);

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                        style={{ animationDelay: `${idx * 50}ms` }}>
                        <td className="px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400 font-mono bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200">
                          {idx}
                        </td>
                        {scalarCols.map((c) => {
                          const v = row?.[c];
                          const cellPath = pathJoin(pathJoin(path, idx), c);
                          return (
                            <td
                              key={c}
                              className="px-2 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30 text-center align-middle"
                              style={{
                                maxWidth: "150px",
                                wordWrap: "break-word",
                                whiteSpace: "normal",
                                lineHeight: "1.4",
                              }}>
                              <div className="flex items-center justify-center min-h-[20px]">
                                <EditableScalar
                                  value={v}
                                  readOnly={!canEditScalar?.(cellPath, v)}
                                  onCommit={(next) =>
                                    onEditScalar?.(cellPath, next)
                                  }
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-1 py-3 text-center text-sm text-gray-500 dark:text-gray-400 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                          {/* Get CRUD info for this path */}
                          {(() => {
                            const tableInfo = schema?.byPath[path];
                            return tableInfo?.allowCrud ? (
                              <div className="flex items-center justify-center gap-1">
                                {/* Add Row button */}
                                <button
                                  onClick={() => {
                                    console.log(`➕ ADD ROW DEBUG:`);
                                    console.log(`  - Row index: ${idx}`);
                                    console.log(`  - Path: "${path}"`);
                                    console.log(`  - TableInfo:`, tableInfo);
                                    console.log(
                                      `  - Calling onCreateRow with path: "${path}"`
                                    );
                                    onCreateRow?.(path);
                                  }}
                                  className="p-1.5 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-800 rounded transition-colors duration-150"
                                  title={`Add row after row ${idx + 1}`}>
                                  <Plus className="w-4 h-4" />
                                </button>
                                {/* Delete Row button */}
                                <button
                                  onClick={() => {
                                    // Use row index for # column, otherwise use the actual PK field value
                                    const pkField = tableInfo?.pkField || "id";
                                    const pkValue =
                                      pkField === "#"
                                        ? idx
                                        : row[pkField] !== undefined
                                        ? row[pkField]
                                        : idx;
                                    console.log(`🔥 DELETE ROW DEBUG:`);
                                    console.log(`  - Row index: ${idx}`);
                                    console.log(`  - Path: "${path}"`);
                                    console.log(`  - PK Field: "${pkField}"`);
                                    console.log(`  - PK Value: ${pkValue}`);
                                    console.log(`  - Row data:`, row);
                                    console.log(`  - TableInfo:`, tableInfo);
                                    console.log(
                                      `  - Calling onDeleteRow with path: "${path}", pkValue: ${pkValue}`
                                    );
                                    onDeleteRow?.(path, pkValue);
                                  }}
                                  className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors duration-150"
                                  title={`Delete row ${idx + 1}`}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="italic">—</span>
                            );
                          })()}
                        </td>
                        <td className="px-1 py-3 text-center border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                          {nestedKeys.length > 0 && (
                            <button
                              onClick={() =>
                                setOpen((s) => ({ ...s, [rowKey]: !s[rowKey] }))
                              }
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors duration-150 text-sm font-mono">
                              {isOpen ? "▾" : "▸"}
                            </button>
                          )}
                        </td>
                      </tr>

                      {isOpen && nestedKeys.length > 0 && (
                        <tr>
                          <td
                            colSpan={scalarCols.length + 3}
                            className="px-2 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-blue-200/50 dark:border-gray-700">
                            <Nest>
                              <NextLevelKeys
                                host={row}
                                keys={nestedKeys}
                                path={pathJoin(path, idx)}
                                filePath={filePath}
                                schema={schema}
                                canEditScalar={canEditScalar}
                                onEditScalar={onEditScalar}
                                onCreateRow={onCreateRow}
                                onDeleteRow={onDeleteRow}
                                onEditRow={onEditRow}
                                maxCols={maxCols}
                                maxRows={maxRows}
                              />
                            </Nest>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Array of scalars → simple table
    const allScalars = arr.every((x) => isScalar(x));
    if (allScalars) {
      return (
        <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg overflow-hidden bg-white dark:bg-gray-800">
          <div
            className="overflow-auto max-h-full custom-scrollbar"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#3b82f6 #dbeafe",
              maxHeight: "60vh",
            }}>
            <table
              className="w-full border-collapse text-sm"
              style={{ tableLayout: "auto" }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                  <th
                    className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                    style={{ width: "40px" }}>
                    #
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 transition-all duration-200 whitespace-nowrap">
                    value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {arr.map((v, i) => (
                  <tr
                    key={i}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                    style={{ animationDelay: `${i * 50}ms` }}>
                    <td className="px-2 py-2 text-center text-xs text-gray-500 dark:text-gray-400 font-mono bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200">
                      {i}
                    </td>
                    <td
                      className="px-2 py-2 text-sm text-gray-900 dark:text-gray-100 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                      style={{ width: "1%" }}>
                      <EditableScalar
                        value={v}
                        readOnly={!canEditScalar?.(pathJoin(path, i), v)}
                        onCommit={(next) =>
                          onEditScalar?.(pathJoin(path, i), next)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Mixed array — list rows with expand if nested
    return (
      <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg overflow-hidden bg-white dark:bg-gray-800">
        <div
          className="overflow-auto max-h-full custom-scrollbar"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#3b82f6 #dbeafe",
            maxHeight: "60vh",
          }}>
          <table
            className="w-full border-collapse text-sm"
            style={{ tableLayout: "auto" }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                <th
                  className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                  style={{ width: "40px" }}>
                  #
                </th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200 whitespace-nowrap">
                  value
                </th>
                <th
                  className="px-1 py-2 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 select-none transition-all duration-200"
                  style={{ width: "40px" }}>
                  Expand
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {arr.map((v, i) => {
                const nested = !isScalar(v);
                const isOpen = !!open[i];
                return (
                  <React.Fragment key={i}>
                    <tr
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                      style={{ animationDelay: `${i * 50}ms` }}>
                      <td className="px-2 py-3 text-center text-xs text-gray-500 dark:text-gray-400 font-mono bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                        <div className="flex items-center justify-center min-h-[20px]">
                          {i}
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30 text-center align-middle"
                        style={{
                          maxWidth: "200px",
                          wordWrap: "break-word",
                          whiteSpace: "normal",
                          lineHeight: "1.4",
                        }}>
                        <div className="flex items-center justify-center min-h-[20px]">
                          {!nested ? (
                            <EditableScalar
                              value={v}
                              readOnly={!canEditScalar?.(pathJoin(path, i), v)}
                              onCommit={(next) =>
                                onEditScalar?.(pathJoin(path, i), next)
                              }
                            />
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400 italic">
                              {short(v)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1 py-3 text-center border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 align-middle">
                        {nested ? (
                          <button
                            onClick={() =>
                              setOpen((s) => ({ ...s, [i]: !s[i] }))
                            }
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors duration-150 text-sm font-mono">
                            {isOpen ? "▾" : "▸"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {nested && isOpen && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-2 py-2 bg-gray-50/50 dark:bg-gray-800/50 border-b border-blue-200/50 dark:border-gray-700">
                          <Nest>
                            <InfoLevel
                              value={v}
                              path={pathJoin(path, i)}
                              filePath={filePath}
                              schema={schema}
                              canEditScalar={canEditScalar}
                              onEditScalar={onEditScalar}
                              onCreateRow={onCreateRow}
                              onDeleteRow={onDeleteRow}
                              onEditRow={onEditRow}
                              maxCols={maxCols}
                              maxRows={maxRows}
                            />
                          </Nest>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /** SCALAR */
  return (
    <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-6 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-center min-h-[100px]">
        <EditableScalar
          value={value}
          readOnly={!canEditScalar?.(path, value)}
          onCommit={(next) => onEditScalar?.(path, next)}
        />
      </div>
    </div>
  );
}

/** Shows ONLY next-level nested keys for a given host object/row.
 *  Each nested key becomes a tab that shows the data in the same tabular format as top-level.
 */
function NextLevelKeys({
  host,
  keys,
  path,
  filePath,
  schema,
  canEditScalar,
  onEditScalar,
  onCreateRow,
  onDeleteRow,
  onEditRow,
  maxCols,
  maxRows,
}: {
  host: any;
  keys: string[];
  path: string;
  filePath: string;
  schema?: JsonSchema | null;
  canEditScalar?: (path: string, value: unknown) => boolean;
  onEditScalar?: (path: string, next: any) => Promise<void> | void;
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, rowId: string | number) => void;
  onEditRow?: (
    path: string,
    field: string,
    newValue: any,
    oldValue: any,
    pkValue: any
  ) => void;
  maxCols: number;
  maxRows: number;
}) {
  const [activeTab, setActiveTab] = useState(keys[0] || "");

  if (!keys.length) {
    return <div style={{ color: "#6b7280" }}>No nested fields.</div>;
  }

  const activeValue = host?.[activeTab];
  const activePath = pathJoin(path, activeTab);

  return (
    <div>
      {/* Nested Tabs */}
      <Tabs tabs={keys} value={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <InfoLevel
        value={activeValue}
        path={activePath}
        filePath={filePath}
        schema={schema}
        canEditScalar={canEditScalar}
        onEditScalar={onEditScalar}
        onCreateRow={onCreateRow}
        onDeleteRow={onDeleteRow}
        onEditRow={onEditRow}
        maxCols={maxCols}
        maxRows={maxRows}
      />
    </div>
  );
}
