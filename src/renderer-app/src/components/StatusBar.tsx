import {
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import Tooltip from "./Tooltip";

interface StatusBarProps {
  selectedCell?: { row: number; col: number } | null;
  totalRows?: number;
  totalCols?: number;
  selectedRange?: string;
  sum?: number;
  average?: number;
  count?: number;
  readOnly?: boolean;
  sheetName?: string;
  activeSheet?: string;
  // pagination
  page?: number;
  totalPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onJumpPage?: (page: number) => void;
}

export default function StatusBar({
  selectedCell,
  totalRows = 0,
  totalCols = 0,
  selectedRange,
  sum,
  average,
  count,
  readOnly = false,
  sheetName,
  activeSheet,
  // pagination
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  onJumpPage,
}: StatusBarProps) {
  const [jumpValue, setJumpValue] = useState<string>(
    page !== undefined ? String(page) : ""
  );

  useEffect(() => {
    setJumpValue(page !== undefined ? String(page) : "");
  }, [page]);
  return (
    <div className="status-bar bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border-t border-blue-200 dark:border-gray-700 px-6 py-3 text-sm text-blue-700 dark:text-gray-200 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-6">
        {/* Sheet Info */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-blue-800 dark:text-gray-200">
            Sheet:
          </span>
          <span className="text-blue-900 dark:text-gray-100 font-semibold bg-blue-100 dark:bg-transparent px-3 py-1 rounded-lg border border-blue-200 dark:border-gray-700">
            {activeSheet || "None"}
          </span>
        </div>

        {readOnly && (
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg text-xs font-medium border border-amber-200 dark:border-amber-700">
            READ ONLY
          </span>
        )}

        <span className="text-blue-700 dark:text-gray-200">
          {totalRows} rows × {totalCols} columns
        </span>
      </div>

      {/* Center - Pagination (optional) + Selection info */}
      <div className="flex flex-col items-center gap-0 text-blue-700 dark:text-gray-200">
        {page !== undefined && totalPages !== undefined && (
          <div className="flex items-center gap-2 text-xs">
            <Tooltip content="Previous page">
              <button
                onClick={onPrevPage}
                disabled={!onPrevPage || page <= 1}
                title="Previous page"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-gray-800 hover:bg-blue-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 dark:text-gray-200 transition-all duration-200">
                <ChevronLeft size={16} />
              </button>
            </Tooltip>

            <span className="px-2 text-xs text-blue-800 font-medium">
              {page} / {totalPages}
            </span>

            <Tooltip content="Next page">
              <button
                onClick={onNextPage}
                disabled={!onNextPage || page >= totalPages}
                title="Next page"
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-gray-800 hover:bg-blue-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-blue-700 dark:text-gray-200 transition-all duration-200">
                <ChevronRight size={16} />
              </button>
            </Tooltip>

            <div className="flex items-center gap-1 ml-2">
              <Tooltip content="Jump to page (press Enter)">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpValue}
                  onChange={(e) => setJumpValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && onJumpPage) {
                      const n = parseInt(jumpValue || "", 10);
                      if (!isNaN(n) && n >= 1 && n <= (totalPages || n)) {
                        onJumpPage(n);
                      }
                    }
                  }}
                  className="w-14 px-2 py-1 border border-blue-200 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  aria-label="Jump to page"
                />
              </Tooltip>
              <Tooltip content="Go to entered page">
                <button
                  onClick={() => {
                    if (!onJumpPage) return;
                    const n = parseInt(jumpValue || "", 10);
                    if (!isNaN(n) && n >= 1 && n <= (totalPages || n)) {
                      onJumpPage(n);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 transition-all duration-200">
                  <ArrowRight size={12} />
                  Go
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-blue-700 dark:text-gray-200">
          {selectedRange && (
            <span className="font-medium">Selected: {selectedRange}</span>
          )}

          {count !== undefined && count > 1 && (
            <div className="flex items-center gap-3">
              <span>
                Count: <span className="font-medium">{count}</span>
              </span>
              {sum !== undefined && (
                <span>
                  Sum:{" "}
                  <span className="font-medium">{sum.toLocaleString()}</span>
                </span>
              )}
              {average !== undefined && (
                <span>
                  Average:{" "}
                  <span className="font-medium">{average.toFixed(2)}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side - Ready status */}
      <div className="flex items-center gap-2">
        <CheckCircle size={16} className="text-green-600" />
        <span className="text-green-700 font-medium">Ready</span>
      </div>
    </div>
  );
}
