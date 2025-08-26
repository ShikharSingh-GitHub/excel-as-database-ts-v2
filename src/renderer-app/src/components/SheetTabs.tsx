import React from "react";

export default function SheetTabs({
  sheets = [],
  active,
  onSelect,
}: {
  sheets?: { name: string; rows?: number }[];
  active?: string | null;
  onSelect?: (name: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b pb-2 overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div className="flex gap-2 overflow-x-auto">
        {sheets.map((s) => (
          <button
            key={s.name}
            onClick={() => onSelect && onSelect(s.name)}
            className={`px-3 py-2 rounded-md ${
              active === s.name
                ? "underline text-violet-600"
                : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}>
            {s.name}{" "}
            <span className="text-xs text-slate-400">({s.rows ?? 0})</span>
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => onSelect && onSelect(active || "")}
          className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          title="Reload">
          ⟳
        </button>
      </div>
    </div>
  );
}
