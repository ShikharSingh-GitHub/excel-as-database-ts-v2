import React, { useCallback, useMemo, useState } from "react";

/** ---------- helpers ---------- */
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

/** Tabs matching codebase design */
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

/** Inline scalar editor matching codebase design */
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
      <span className="text-gray-900 dark:text-gray-100">
        {value == null || value === "" ? (
          <span className="text-gray-400 dark:text-gray-500 italic">—</span>
        ) : (
          String(value)
        )}
      </span>
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
        className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors duration-150">
        {value == null || value === "" ? (
          <span className="text-gray-400 dark:text-gray-500 italic">—</span>
        ) : (
          String(value)
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
      className="border border-blue-300 dark:border-blue-600 rounded px-2 py-1 min-w-20 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

/** A bordered box used for nested content matching codebase design */
function Nest({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 p-4 border border-dashed border-blue-200 dark:border-blue-700 rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/20">
      {children}
    </div>
  );
}

/** ---------- main component ---------- */
export type CollapsibleJsonViewProps = {
  /** Whole JSON object */
  data: any;
  /** Start from this key (e.g. "data"); if omitted, use root */
  rootKey?: string;
  /** Optional: order tabs */
  tabOrder?: string[];

  /** CRUD wiring (opt-in later) */
  canEditScalar?: (path: string, value: unknown) => boolean;
  onEditScalar?: (path: string, next: unknown) => Promise<void> | void;
  /** Arrays of objects: to later enable row add/delete you can provide handlers below */
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, rowId: string | number) => void;

  /** Optional caps for very wide/long structures */
  maxCols?: number; // default 50
  maxRows?: number; // default 500
};

export default function CollapsibleJsonView({
  data,
  rootKey,
  tabOrder,
  canEditScalar,
  onEditScalar,
  onCreateRow,
  onDeleteRow,
  maxCols = 50,
  maxRows = 500,
}: CollapsibleJsonViewProps) {
  const root = rootKey ? data?.[rootKey] : data;

  // top-level tabs = keys of the root (object). If root is not an object, show single pseudo-tab.
  const allTabs = useMemo<string[]>(() => {
    if (!root || typeof root !== "object" || Array.isArray(root))
      return ["(value)"];
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

  const [active, setActive] = useState(allTabs[0]);

  const activeValue = useMemo(() => {
    if (allTabs.length === 1 && allTabs[0] === "(value)") return root;
    return (root as any)?.[active];
  }, [root, allTabs, active]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden">
      <Tabs tabs={allTabs} value={active} onChange={setActive} />
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <LevelTable
          value={activeValue}
          path={rootKey ? `${rootKey}.${active}` : active}
          canEditScalar={canEditScalar}
          onEditScalar={onEditScalar}
          onCreateRow={onCreateRow}
          onDeleteRow={onDeleteRow}
          maxCols={maxCols}
          maxRows={maxRows}
        />
      </div>
    </div>
  );
}

/** Renders ONE level:
 * - object → rows = keys at this level (scalars inline; nested expandable)
 * - array of objects → columns = union of keys; rows = items; nested cells expandable
 * - array of scalars → single "value" column
 * - scalar → single cell
 */
function LevelTable({
  value,
  path,
  canEditScalar,
  onEditScalar,
  onCreateRow,
  onDeleteRow,
  maxCols,
  maxRows,
}: {
  value: any;
  path: string;
  canEditScalar?: (path: string, value: unknown) => boolean;
  onEditScalar?: (path: string, next: unknown) => Promise<void> | void;
  onCreateRow?: (tablePath: string) => void;
  onDeleteRow?: (tablePath: string, rowId: string | number) => void;
  maxCols: number;
  maxRows: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  /** OBJECT */
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    // Scalars first, then nested keys
    const scalarKeys = keys.filter((k) => isScalar((value as any)[k]));
    const nestedKeys = keys.filter((k) => !scalarKeys.includes(k));
    const ordered = [...scalarKeys, ...nestedKeys].slice(0, maxCols);

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
            className="w-full border-collapse"
            style={{ tableLayout: "auto" }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                  style={{ minWidth: "200px", width: "200px" }}>
                  Key
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 transition-all duration-200"
                  style={{ minWidth: "300px" }}>
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {ordered.map((k, index) => {
                const v = (value as any)[k];
                const rowPath = pathJoin(path, k);
                const nested = !isScalar(v);
                const isOpen = !!open[k];

                return (
                  <React.Fragment key={k}>
                    <tr
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                      style={{ animationDelay: `${index * 50}ms` }}>
                      <td
                        className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                        style={{ verticalAlign: "top" }}>
                        <div className="flex items-center gap-2">
                          {nested ? (
                            <button
                              onClick={() =>
                                setOpen((s) => ({ ...s, [k]: !s[k] }))
                              }
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800">
                              {isOpen ? "▼" : "▶"}
                            </button>
                          ) : null}
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {k}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                        style={{ verticalAlign: "top" }}>
                        {!nested ? (
                          <EditableScalar
                            value={v}
                            readOnly={!canEditScalar?.(rowPath, v)}
                            onCommit={(next) => onEditScalar?.(rowPath, next)}
                          />
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {short(v)}
                          </span>
                        )}
                      </td>
                    </tr>

                    {nested && isOpen && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-b border-blue-200/50 dark:border-gray-700">
                          <Nest>
                            <LevelTable
                              value={v}
                              path={rowPath}
                              canEditScalar={canEditScalar}
                              onEditScalar={onEditScalar}
                              onCreateRow={onCreateRow}
                              onDeleteRow={onDeleteRow}
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

    // Array of objects?
    const objectItems = arr.filter(
      (x) => x && typeof x === "object" && !Array.isArray(x)
    );
    const scalarItems = arr.filter((x) => isScalar(x));
    const isArrayOfObjects =
      objectItems.length === arr.length && arr.length > 0;
    const isArrayOfScalars = scalarItems.length === arr.length;

    if (isArrayOfObjects) {
      // union of keys
      const keySet = new Set<string>();
      for (const o of objectItems.slice(0, maxCols))
        for (const k of Object.keys(o)) keySet.add(k);
      const columns = [...keySet];

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
              className="w-full border-collapse"
              style={{ tableLayout: "auto" }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                  <th
                    className="px-3 py-3 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                    style={{ width: "60px", minWidth: "60px" }}>
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                      style={{ minWidth: "120px" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {arr.map((item, idx) => {
                  const row = item as Record<string, any>;
                  const rowKey = `r${idx}`;
                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                        style={{ animationDelay: `${idx * 50}ms` }}>
                        <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400 font-mono bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200">
                          {idx}
                        </td>
                        {columns.map((col) => {
                          const cellVal = row[col];
                          const cellPath = pathJoin(pathJoin(path, idx), col);
                          const nested = !isScalar(cellVal);
                          const openKey = `${rowKey}:${col}`;
                          const isOpen = !!(open as any)[openKey];

                          return (
                            <td
                              key={col}
                              className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                              style={{ verticalAlign: "top" }}>
                              {!nested ? (
                                <EditableScalar
                                  value={cellVal}
                                  readOnly={!canEditScalar?.(cellPath, cellVal)}
                                  onCommit={(next) =>
                                    onEditScalar?.(cellPath, next)
                                  }
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      setOpen((s) => ({
                                        ...s,
                                        [openKey]: !s[openKey],
                                      }))
                                    }
                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800">
                                    {isOpen ? "▼" : "▶"}
                                  </button>
                                  <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                    {short(cellVal)}
                                  </span>
                                </div>
                              )}
                              {nested && isOpen && (
                                <div className="mt-2">
                                  <Nest>
                                    <LevelTable
                                      value={cellVal}
                                      path={cellPath}
                                      canEditScalar={canEditScalar}
                                      onEditScalar={onEditScalar}
                                      onCreateRow={onCreateRow}
                                      onDeleteRow={onDeleteRow}
                                      maxCols={maxCols}
                                      maxRows={maxRows}
                                    />
                                  </Nest>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (isArrayOfScalars) {
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
              className="w-full border-collapse"
              style={{ tableLayout: "auto" }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                  <th
                    className="px-3 py-3 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                    style={{ width: "60px", minWidth: "60px" }}>
                    #
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 transition-all duration-200"
                    style={{ minWidth: "300px" }}>
                    value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900">
                {arr.map((v, i) => {
                  const cellPath = pathJoin(path, i);
                  return (
                    <tr
                      key={i}
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                      style={{ animationDelay: `${i * 50}ms` }}>
                      <td className="px-3 py-3 text-center text-xs text-gray-500 dark:text-gray-400 font-mono bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200">
                        {i}
                      </td>
                      <td
                        className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                        style={{ verticalAlign: "top" }}>
                        <EditableScalar
                          value={v}
                          readOnly={!canEditScalar?.(cellPath, v)}
                          onCommit={(next) => onEditScalar?.(cellPath, next)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // mixed array (objects + scalars or arrays) → list each element as a row with expander if nested
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
            className="w-full border-collapse"
            style={{ tableLayout: "auto" }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
                <th
                  className="px-3 py-3 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200"
                  style={{ width: "60px", minWidth: "60px" }}>
                  #
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 transition-all duration-200"
                  style={{ minWidth: "300px" }}>
                  value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {arr.map((v, i) => {
                const elemPath = pathJoin(path, i);
                const nested = !isScalar(v);
                const isOpen = !!open[i];
                return (
                  <React.Fragment key={i}>
                    <tr
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-800/20 transition-all duration-200 animate-in fade-in-0 slide-in-from-top-1"
                      style={{ animationDelay: `${i * 50}ms` }}>
                      <td
                        className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                        style={{ verticalAlign: "top" }}>
                        <div className="flex items-center gap-2">
                          {nested ? (
                            <button
                              onClick={() =>
                                setOpen((s) => ({ ...s, [i]: !s[i] }))
                              }
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-150 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800">
                              {isOpen ? "▼" : "▶"}
                            </button>
                          ) : null}
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {i}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100 border-b border-blue-200/50 dark:border-gray-700 transition-all duration-200 hover:bg-blue-50/50 dark:hover:bg-blue-800/30"
                        style={{ verticalAlign: "top" }}>
                        {!nested ? (
                          <EditableScalar
                            value={v}
                            readOnly={!canEditScalar?.(elemPath, v)}
                            onCommit={(next) => onEditScalar?.(elemPath, next)}
                          />
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {short(v)}
                          </span>
                        )}
                      </td>
                    </tr>
                    {nested && isOpen && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-3 bg-gray-50/50 dark:bg-gray-800/50 border-b border-blue-200/50 dark:border-gray-700">
                          <Nest>
                            <LevelTable
                              value={v}
                              path={elemPath}
                              canEditScalar={canEditScalar}
                              onEditScalar={onEditScalar}
                              onCreateRow={onCreateRow}
                              onDeleteRow={onDeleteRow}
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
    <div className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg p-4 bg-white dark:bg-gray-800">
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
