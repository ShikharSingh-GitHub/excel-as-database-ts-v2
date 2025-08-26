import React, { useMemo, useState } from "react";

export default function DataGrid({
  headers = [],
  rows = [],
  onEdit,
  onDelete,
  readOnly = false,
  // server-driven pagination props
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,
  // filter & search
  filter = "",
  onSearch,
  onColumnFilters,
  onSortChange,
}: {
  headers?: string[];
  rows?: any[];
  onEdit?: (r: any) => void;
  onDelete?: (r: any) => void;
  readOnly?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (p: number) => void;
  filter?: string;
  onSearch?: (q: string) => void;
  onColumnFilters?: (filters: Record<string, string>) => void;
  onSortChange?: (sort: { key: string | null; dir: "asc" | "desc" }) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [localSearch, setLocalSearch] = useState<string>(filter || "");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows || [];
    const copy = [...(rows || [])];
    copy.sort((a: any, b: any) => {
      const A = a[sortKey];
      const B = b[sortKey];
      if (A == null && B == null) return 0;
      if (A == null) return -1;
      if (B == null) return 1;
      if (typeof A === "number" && typeof B === "number")
        return sortDir === "asc" ? A - B : B - A;
      const sA = String(A).toLowerCase();
      const sB = String(B).toLowerCase();
      if (sA < sB) return sortDir === "asc" ? -1 : 1;
      if (sA > sB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const handleHeaderClick = (h: string) => {
    const newKey = h;
    const newDir = sortKey === h ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(newKey);
    setSortDir(newDir);
    if (typeof onSortChange === "function") {
      onSortChange({ key: newKey, dir: newDir });
    }
  };

  const showFrom = (page - 1) * pageSize + 1;
  const showTo = Math.min(page * pageSize, total || (rows || []).length);

  // Sync prop filter -> localSearch
  React.useEffect(() => {
    if (filter !== localSearch) setLocalSearch(filter || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Debounce search callback
  React.useEffect(() => {
    if (!onSearch) return;
    const t = setTimeout(() => onSearch(localSearch || ""), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  // Debounce column filters
  React.useEffect(() => {
    if (!onColumnFilters) return;
    const t = setTimeout(() => onColumnFilters(colFilters || {}), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colFilters]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white/60 p-2 backdrop-blur-md dark:border-slate-700 dark:bg-white/5">
        <input
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search"
          className="h-8 w-64 rounded border px-2"
        />
        <div className="ml-auto flex gap-1">Toolbar</div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
            <tr>
              {headers.map((h, idx) => (
                <th
                  key={h}
                  data-testid={`hdr-${idx}`}
                  className="p-2 text-left cursor-pointer select-none"
                  onClick={() => handleHeaderClick(h)}>
                  <div className="flex items-center gap-2">
                    <span>{h}</span>
                    {sortKey === h && (
                      <span className="text-xs text-slate-500">
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-2">Actions</th>
            </tr>
            <tr>
              {headers.map((h, idx) => (
                <th key={h} className="p-1">
                  <input
                    data-testid={`col-filter-${idx}`}
                    value={colFilters[h] || ""}
                    onChange={(e) =>
                      setColFilters((prev) => ({
                        ...prev,
                        [h]: e.target.value,
                      }))
                    }
                    placeholder="Filter"
                    className="w-full text-xs border px-1 py-1"
                  />
                </th>
              ))}
              <th className="p-1"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r, i) => (
              <tr
                key={i}
                className="odd:bg-slate-50 even:bg-white dark:odd:bg-slate-800 dark:even:bg-slate-900">
                {headers.map((h) => (
                  <td key={h} className="p-2">
                    {String(r[h] ?? "")}
                  </td>
                ))}
                <td className="p-2 text-right">
                  {!readOnly && (
                    <>
                      <button
                        className="mr-2 px-2 py-1 bg-blue-500 text-white rounded"
                        onClick={() => onEdit && onEdit(r)}>
                        Edit
                      </button>
                      <button
                        className="px-2 py-1 bg-red-500 text-white rounded"
                        onClick={() => onDelete && onDelete(r)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20">
        <div className="text-sm text-slate-600">
          Showing {showFrom} — {showTo} of {total ?? (rows || []).length}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onPageChange && onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1 rounded border bg-white disabled:opacity-50">
            Prev
          </button>
          <div className="text-sm">Page {page}</div>
          <button
            onClick={() => onPageChange && onPageChange(page + 1)}
            disabled={Boolean(total) && page * pageSize >= (total || 0)}
            className="px-3 py-1 rounded border bg-white disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
