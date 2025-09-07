import { LayoutGrid, RefreshCw, Table } from "lucide-react";
import React from "react";
import Tooltip from "./Tooltip";

export type JsonViewMode = "hierarchical" | "collapsible";

export default function SheetTabs({
  sheets = [],
  active,
  onSelect,
  readOnlySheets = [],
  jsonViewMode,
  onJsonViewModeChange,
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
  jsonViewMode?: JsonViewMode;
  onJsonViewModeChange?: (mode: JsonViewMode) => void;
}) {
  return (
    <div className="p-2 border-b border-blue-200/50 bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center gap-2 h-10 px-4 overflow-hidden">
        <div className="flex gap-2 overflow-x-auto">
          {sheets.map((s) => {
            const isReadOnly = readOnlySheets.includes(s.name);
            const isUnavailable = s.unavailable;
            const hasCustomHeader = s.headerRow && s.headerRow > 1;

            const tooltipContent = isUnavailable
              ? "Sheet has no headers - cannot be used"
              : isReadOnly
              ? `${s.name} - Read only sheet (${s.rows ?? 0} rows)`
              : `${s.name} - ${s.rows ?? 0} rows${
                  hasCustomHeader ? `, headers at row ${s.headerRow}` : ""
                }`;

            return (
              <Tooltip key={s.name} content={tooltipContent}>
                <button
                  onClick={() => onSelect && onSelect(s.name)}
                  disabled={isUnavailable}
                  className={`px-3 py-2 rounded-md flex items-center gap-2 ${
                    active === s.name
                      ? "underline text-violet-600 bg-violet-50 dark:bg-violet-900/40"
                      : isUnavailable
                      ? "text-slate-400 dark:text-slate-500 cursor-not-allowed"
                      : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}>
                  <span className="truncate">{s.name}</span>
                  <span className="text-xs text-slate-400">
                    ({s.rows ?? 0})
                  </span>
                  {hasCustomHeader && (
                    <span className="text-xs bg-blue-100 dark:bg-transparent text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded">
                      R{s.headerRow}
                    </span>
                  )}
                  {isReadOnly && (
                    <span className="text-xs bg-orange-100 dark:bg-transparent text-orange-800 dark:text-orange-200 px-1.5 py-0.5 rounded">
                      RO
                    </span>
                  )}
                  {isUnavailable && (
                    <span className="text-xs bg-red-100 dark:bg-transparent text-red-800 dark:text-red-200 px-1.5 py-0.5 rounded">
                      No Headers
                    </span>
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {jsonViewMode && onJsonViewModeChange && (
            <Tooltip
              content={`Switch to ${
                jsonViewMode === "hierarchical"
                  ? "Collapsible Table"
                  : "Hierarchical"
              } view`}>
              <button
                onClick={() =>
                  onJsonViewModeChange(
                    jsonViewMode === "hierarchical"
                      ? "collapsible"
                      : "hierarchical"
                  )
                }
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                aria-label="Toggle JSON view mode">
                {jsonViewMode === "hierarchical" ? (
                  <Table size={16} />
                ) : (
                  <LayoutGrid size={16} />
                )}
              </button>
            </Tooltip>
          )}
          <Tooltip content="Reload current sheet">
            <button
              onClick={() => onSelect && onSelect(active || "")}
              className="p-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-label="Reload sheet">
              <RefreshCw size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
