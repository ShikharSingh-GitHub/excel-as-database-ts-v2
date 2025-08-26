import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export default function SheetTabs({ sheets = [], active, onSelect, }) {
    return (_jsxs("div", { className: "flex items-center gap-2 border-b pb-2 overflow-hidden bg-slate-50 dark:bg-slate-900", children: [_jsx("div", { className: "flex gap-2 overflow-x-auto", children: sheets.map((s) => (_jsxs("button", { onClick: () => onSelect && onSelect(s.name), className: `px-3 py-2 rounded-md ${active === s.name
                        ? "underline text-violet-600"
                        : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"}`, children: [s.name, " ", _jsxs("span", { className: "text-xs text-slate-400", children: ["(", s.rows ?? 0, ")"] })] }, s.name))) }), _jsx("div", { className: "ml-auto flex items-center gap-2", children: _jsx("button", { onClick: () => onSelect && onSelect(active || ""), className: "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800", title: "Reload", children: "\u27F3" }) })] }));
}
//# sourceMappingURL=SheetTabs.js.map