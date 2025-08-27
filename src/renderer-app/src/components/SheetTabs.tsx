import React from "react";
import Tooltip from "./Tooltip";

export default function SheetTabs({
  sheets = [],
  active,
  onSelect,
  readOnlySheets = [],
}: {
  sheets?: {
    name: string;
    rows?: number;
    unavailable?: boolean;
    headerRow?: number;
    totalRows?: number;
  }[];
  active?: string | null;
  onSelect?: (name: string) => void;
  readOnlySheets?: string[];
}) {
  return (
    <div className="flex items-center gap-2 border-b pb-2 overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div className="flex gap-2 overflow-x-auto">
        {sheets.map((s) => {
          const isReadOnly = readOnlySheets.includes(s.name);
          const isUnavailable = s.unavailable;
          const hasCustomHeader = s.headerRow && s.headerRow > 1;
          
          const tooltipContent = isUnavailable 
            ? "Sheet has no headers - cannot be used"
            : isReadOnly 
            ? `${s.name} - Read only sheet (${s.rows ?? 0} rows)`
            : `${s.name} - ${s.rows ?? 0} rows${hasCustomHeader ? `, headers at row ${s.headerRow}` : ''}`;

          return (
            <Tooltip key={s.name} content={tooltipContent}>
              <button
                onClick={() => onSelect && onSelect(s.name)}
                disabled={isUnavailable}
                className={`px-3 py-2 rounded-md flex items-center gap-2 ${
                  active === s.name
                    ? "underline text-violet-600 bg-violet-50 dark:bg-violet-900/40"
                    : isUnavailable
                    ? "text-slate-400 cursor-not-allowed"
                    : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}>
                <span className="truncate">{s.name}</span>
                <span className="text-xs text-slate-400">({s.rows ?? 0})</span>
                {hasCustomHeader && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    R{s.headerRow}
                  </span>
                )}
                {isReadOnly && (
                  <span className="text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                    RO
                  </span>
                )}
                {isUnavailable && (
                  <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                    No Headers
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip content="Reload current sheet">
          <button
            onClick={() => onSelect && onSelect(active || "")}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
            ⟳
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
