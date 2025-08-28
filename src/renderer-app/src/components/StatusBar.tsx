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
    <div className="status-bar bg-white/95 backdrop-blur-sm border-t border-gray-200/50 px-4 py-3 text-sm text-gray-600 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-6">
        {/* Sheet Info */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Sheet:</span>
          <span className="text-gray-900 font-semibold bg-blue-50 px-2 py-1 rounded">
            {activeSheet || "None"}
          </span>
        </div>

        {readOnly && (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
            READ ONLY
          </span>
        )}

        <span>
          {totalRows} rows × {totalCols} columns
        </span>
      </div>

      {/* Center - Pagination (optional) + Selection info */}
      <div className="flex flex-col items-center gap-0">
        {page !== undefined && totalPages !== undefined && (
          <div className="flex items-center gap-2 text-xs">
            <Tooltip content="Previous page">
              <button
                onClick={onPrevPage}
                disabled={!onPrevPage || page <= 1}
                title="Previous page"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
                ◀
              </button>
            </Tooltip>

            <span className="px-1 text-xs text-gray-600">
              {page} / {totalPages}
            </span>

            <Tooltip content="Next page">
              <button
                onClick={onNextPage}
                disabled={!onNextPage || page >= totalPages}
                title="Next page"
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
                ▶
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
                  className="w-14 px-1 py-0.5 border rounded text-xs bg-white"
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
                  className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs hover:bg-blue-700">
                  Go
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          {selectedRange && <span>Selected: {selectedRange}</span>}

          {count !== undefined && count > 1 && (
            <div className="flex items-center gap-3">
              <span>Count: {count}</span>
              {sum !== undefined && <span>Sum: {sum.toLocaleString()}</span>}
              {average !== undefined && (
                <span>Average: {average.toFixed(2)}</span>
              )}
            </div>
          )}

          {/* numeric rows count removed from center per preference */}
        </div>
      </div>

      {/* Right side - Ready status */}
      <div className="flex items-center gap-2">
        <span className="text-green-600">Ready</span>
      </div>
    </div>
  );
}
