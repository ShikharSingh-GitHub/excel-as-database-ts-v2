import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useMemo, useState } from "react";
export default function DataGrid({ headers = [], rows = [], onEdit, onDelete, 
// server-driven pagination props
page = 1, pageSize = 25, total = 0, onPageChange, 
// filter & search
filter = "", onSearch, }) {
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState("asc");
    const [localSearch, setLocalSearch] = useState(filter || "");
    const sortedRows = useMemo(() => {
        if (!sortKey)
            return rows || [];
        const copy = [...(rows || [])];
        copy.sort((a, b) => {
            const A = a[sortKey];
            const B = b[sortKey];
            if (A == null && B == null)
                return 0;
            if (A == null)
                return -1;
            if (B == null)
                return 1;
            if (typeof A === "number" && typeof B === "number")
                return sortDir === "asc" ? A - B : B - A;
            const sA = String(A).toLowerCase();
            const sB = String(B).toLowerCase();
            if (sA < sB)
                return sortDir === "asc" ? -1 : 1;
            if (sA > sB)
                return sortDir === "asc" ? 1 : -1;
            return 0;
        });
        return copy;
    }, [rows, sortKey, sortDir]);
    const handleHeaderClick = (h) => {
        if (sortKey === h)
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(h);
            setSortDir("asc");
        }
    };
    const showFrom = (page - 1) * pageSize + 1;
    const showTo = Math.min(page * pageSize, total || (rows || []).length);
    // Sync prop filter -> localSearch
    React.useEffect(() => {
        if (filter !== localSearch)
            setLocalSearch(filter || "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);
    // Debounce search callback
    React.useEffect(() => {
        if (!onSearch)
            return;
        const t = setTimeout(() => onSearch(localSearch || ""), 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localSearch]);
    return (_jsxs("div", { className: "flex h-full flex-col", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-slate-200 bg-white/60 p-2 backdrop-blur-md dark:border-slate-700 dark:bg-white/5", children: [_jsx("input", { value: localSearch, onChange: (e) => setLocalSearch(e.target.value), placeholder: "Search", className: "h-8 w-64 rounded border px-2" }), _jsx("div", { className: "ml-auto flex gap-1", children: "Toolbar" })] }), _jsx("div", { className: "flex-1 overflow-auto", children: _jsxs("table", { className: "w-full border-collapse text-sm", children: [_jsx("thead", { className: "sticky top-0 bg-slate-100 dark:bg-slate-800", children: _jsxs("tr", { children: [headers.map((h) => (_jsx("th", { className: "p-2 text-left cursor-pointer select-none", onClick: () => handleHeaderClick(h), children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: h }), sortKey === h && (_jsx("span", { className: "text-xs text-slate-500", children: sortDir === "asc" ? "▲" : "▼" }))] }) }, h))), _jsx("th", { className: "p-2", children: "Actions" })] }) }), _jsx("tbody", { children: sortedRows.map((r, i) => (_jsxs("tr", { className: "odd:bg-slate-50 even:bg-white dark:odd:bg-slate-800 dark:even:bg-slate-900", children: [headers.map((h) => (_jsx("td", { className: "p-2", children: String(r[h] ?? "") }, h))), _jsxs("td", { className: "p-2 text-right", children: [_jsx("button", { className: "mr-2 px-2 py-1 bg-blue-500 text-white rounded", onClick: () => onEdit && onEdit(r), children: "Edit" }), _jsx("button", { className: "px-2 py-1 bg-red-500 text-white rounded", onClick: () => onDelete && onDelete(r), children: "Delete" })] })] }, i))) })] }) }), _jsxs("div", { className: "border-t p-2 flex items-center gap-2 bg-white/50 dark:bg-black/20", children: [_jsxs("div", { className: "text-sm text-slate-600", children: ["Showing ", showFrom, " \u2014 ", showTo, " of ", total ?? (rows || []).length] }), _jsxs("div", { className: "ml-auto flex items-center gap-2", children: [_jsx("button", { onClick: () => onPageChange && onPageChange(Math.max(1, page - 1)), disabled: page <= 1, className: "px-3 py-1 rounded border bg-white disabled:opacity-50", children: "Prev" }), _jsxs("div", { className: "text-sm", children: ["Page ", page] }), _jsx("button", { onClick: () => onPageChange && onPageChange(page + 1), disabled: Boolean(total) && page * pageSize >= (total || 0), className: "px-3 py-1 rounded border bg-white disabled:opacity-50", children: "Next" })] })] })] }));
}
//# sourceMappingURL=DataGrid.js.map