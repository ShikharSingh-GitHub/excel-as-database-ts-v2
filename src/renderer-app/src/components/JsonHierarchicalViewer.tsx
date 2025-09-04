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
    <div
      style={{
        display: "flex",
        gap: 8,
        borderBottom: "1px solid #e5e7eb",
        marginBottom: 12,
      }}>
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: "8px 12px",
            borderBottom:
              value === t ? "2px solid #111827" : "2px solid transparent",
            fontWeight: value === t ? 600 : 500,
          }}>
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

  return (
    <div>
      <Tabs tabs={tabs} value={active} onChange={setActive} />
      <ColumnExpandableTable
        value={current}
        level={0}
        colCap={maxTopCols}
        nestedColCap={maxNestedCols}
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
    let row: any = {}; // single logical row for the outer table

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
              toggle={() =>
                setOpenCols((s) => ({ ...s, [headerId]: !s[headerId] }))
              }
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
              <span style={{ color: "#374151" }}>{/* collapsed */}</span>
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

    if (value && typeof value === "object") {
      const keys = Object.keys(value).slice(0, colCap);
      keys.forEach((k) => {
        const v = (value as any)[k];
        const headerId = k;
        const canExpand = !isScalar(v);
        cols.push({
          id: headerId,
          header: () => (
            <HeaderExpander
              title={k}
              summary={preview(v)}
              open={!!openCols[headerId]}
              toggle={
                canExpand
                  ? () =>
                      setOpenCols((s) => ({ ...s, [headerId]: !s[headerId] }))
                  : undefined
              }
              disabled={!canExpand}
            />
          ),
          cell: () =>
            openCols[headerId] && canExpand ? (
              <CellNest>
                <RenderNested
                  value={v}
                  level={level + 1}
                  colCap={nestedColCap}
                  nestedColCap={nestedColCap}
                />
              </CellNest>
            ) : (
              <span style={{ color: "#374151" }}>
                {isScalar(v) ? preview(v) : ""}
              </span>
            ),
        });
      });

      const overflow = Object.keys(value).length - keys.length;
      return {
        columns: cols,
        singleRow: [value],
        restBadge: overflow > 0 ? `+${overflow}` : "",
      };
    }

    // Scalar → render a single column "value"
    cols.push({
      id: "value",
      header: "value",
      cell: () => <span>{preview(value)}</span>,
    });
    return { columns: cols, singleRow: [{}], restBadge: "" };
  }, [value, colCap, nestedColCap, openCols, level]);

  const table = useReactTable({
    data: singleRow,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      style={{
        border: level === 0 ? "1px solid #e5e7eb" : "1px dashed #d1d5db",
        borderRadius: 8,
        overflow: "auto",
      }}>
      <table style={{ width: "100%", fontSize: 14 }}>
        <thead
          style={{
            background: "#f9fafb",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    whiteSpace: "nowrap",
                  }}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
              {restBadge && (
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 12px",
                    borderBottom: "1px solid #e5e7eb",
                    color: "#6b7280",
                  }}>
                  {restBadge}
                </th>
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id} className="even:bg-gray-50">
              {r.getVisibleCells().map((c) => (
                <td
                  key={c.id}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #f3f4f6",
                    verticalAlign: "top",
                  }}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
              {restBadge && <td />}
            </tr>
          ))}
        </tbody>
      </table>
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
  return <span>{preview(value)}</span>;
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
  const btn = (
    <button
      onClick={toggle}
      disabled={!toggle || disabled}
      style={{
        textDecoration: toggle && !disabled ? "underline" : "none",
        opacity: disabled ? 0.6 : 1,
        cursor: toggle && !disabled ? "pointer" : "default",
      }}
      title={summary}>
      {title} {toggle && !disabled ? (open ? "▾" : "▸") : null}
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {btn}
      <span style={{ fontSize: 12, color: "#6b7280" }}>{summary}</span>
    </div>
  );
}

function CellNest({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 6,
        padding: 8,
        border: "1px dashed #d1d5db",
        borderRadius: 6,
      }}>
      {children}
    </div>
  );
}
