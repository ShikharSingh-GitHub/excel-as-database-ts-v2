import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useMemo, useState } from "react";
import { getAt, parsePath } from "../utils/access";
import { collectPaths } from "../utils/schema";
import Dialog from "./Dialog";

interface AutoTableProps {
  data: any[];
  title?: string;
  maxColumns?: number; // cap visible columns (optional)
}

interface ChildView {
  rows: any[];
  path: string;
  parentIndex: number;
}

function JsonChip({ value }: { value: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="rounded px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        onClick={() => setOpen(true)}>
        {`{…}`}
      </button>
      {open && (
        <Dialog title="JSON" onClose={() => setOpen(false)}>
          <pre className="text-xs whitespace-pre-wrap text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-auto">
            {JSON.stringify(value, null, 2)}
          </pre>
        </Dialog>
      )}
    </>
  );
}

export default function AutoTable({
  data,
  title,
  maxColumns = 50,
}: AutoTableProps) {
  const [childView, setChildView] = useState<ChildView | null>(null);

  const { columns, arrayObjectPaths } = useMemo(() => {
    if (!data?.length)
      return {
        columns: [] as ColumnDef<any>[],
        arrayObjectPaths: new Set<string>(),
      };

    const summary = collectPaths(data);
    // Build scalar + array-of-scalar columns
    const keys = [...summary.scalarPaths, ...summary.arrayScalarPaths].slice(
      0,
      maxColumns
    );

    const cols: ColumnDef<any>[] = keys.map((key) => ({
      id: key,
      header: key,
      accessorFn: (row: any) => getAt(row, parsePath(key)),
      cell: (info) => {
        const v = info.getValue();
        if (Array.isArray(v)) {
          // joined scalar array
          return (v as any[]).join(", ");
        }
        if (v != null && typeof v === "object") {
          // object slipped in → show JSON_chip
          return <JsonChip value={v} />;
        }
        return v == null ? "" : String(v);
      },
    }));

    // Add array-of-object columns as clickable child tables
    for (const path of summary.arrayObjectPaths) {
      cols.push({
        id: path,
        header: path,
        cell: (info) => {
          const arr = getAt(info.row.original, parsePath(path), []);
          const count = Array.isArray(arr) ? arr.length : 0;
          return (
            <button
              className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              onClick={() =>
                count &&
                setChildView({ rows: arr, path, parentIndex: info.row.index })
              }
              disabled={!count}>
              {count ? `${count} items` : "—"}
            </button>
          );
        },
      });
    }

    return { columns: cols, arrayObjectPaths: summary.arrayObjectPaths };
  }, [data, maxColumns]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-2">
      {title && (
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
      )}
      <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="text-left px-3 py-2 font-medium border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr
                key={r.id}
                className="even:bg-gray-50 dark:even:bg-gray-800/50">
                {r.getVisibleCells().map((c) => (
                  <td
                    key={c.id}
                    className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 align-top text-gray-900 dark:text-gray-100">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!data?.length && (
              <tr>
                <td
                  className="px-3 py-4 text-gray-500 dark:text-gray-400"
                  colSpan={columns.length}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Child table modal/drawer */}
      {childView && (
        <Dialog
          onClose={() => setChildView(null)}
          title={`${childView.path} (row ${childView.parentIndex + 1})`}>
          <AutoTable data={childView.rows} />
        </Dialog>
      )}
    </div>
  );
}
