import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useMemo, useState } from "react";

/* ---------- helpers ---------- */
const isScalar = (v: any) => v == null || typeof v !== "object";
const preview = (v: any) =>
  v == null
    ? ""
    : Array.isArray(v)
    ? `[${v.length}]`
    : typeof v === "object"
    ? "{…}"
    : String(v);

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
}: {
  data: any;
  rootKey?: string; // e.g. "data"
  tabOrder?: string[]; // enforce top-level tab order
  maxTopCols?: number; // cap for wide top-level arrays/objects
  maxNestedCols?: number; // cap for nested tables
}) {
  const root = rootKey ? data?.[rootKey] : data;

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
        />
      </div>
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
}: {
  value: any;
  level: number;
  colCap: number;
  nestedColCap: number;
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
          header: () => (
            <HeaderExpander
              title={indexStr}
              summary={preview(nestedVal)}
              open={!!openCols[headerId]}
              toggle={() => {
                setOpenCols((s) => ({ ...s, [headerId]: !s[headerId] }));
              }}
            />
          ),
          cell: () =>
            openCols[headerId] ? (
              <CellNest>
                <RenderNested
                  value={nestedVal}
                  level={level + 1}
                  colCap={nestedColCap}
                  nestedColCap={nestedColCap}
                />
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
              return (
                <span className="text-gray-700 dark:text-gray-300 text-sm font-mono">
                  {v == null ? "" : String(v)}
                </span>
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

/* ---------- Inline nested renderer ---------- */
function RenderNested({
  value,
  level,
  colCap,
  nestedColCap,
}: {
  value: any;
  level: number;
  colCap: number;
  nestedColCap: number;
}) {
  // If nested value is array/object, recurse with ColumnExpandableTable
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return (
      <ColumnExpandableTable
        value={value}
        level={level}
        colCap={colCap}
        nestedColCap={nestedColCap}
      />
    );
  }
  return (
    <span className="text-gray-700 dark:text-gray-300 text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
      {preview(value)}
    </span>
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
