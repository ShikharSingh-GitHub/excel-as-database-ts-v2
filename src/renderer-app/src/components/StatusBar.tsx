import React from "react";

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
}: StatusBarProps) {
  return (
    <div className="status-bar bg-white/95 backdrop-blur-sm border-t border-gray-200/50 px-4 py-3 text-sm text-gray-600 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-6">
        {/* Sheet Info */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Sheet:</span>
          <span className="text-gray-900 font-semibold bg-blue-50 px-2 py-1 rounded">{activeSheet || "None"}</span>
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

      {/* Center - Selection info */}
      <div className="flex items-center gap-4">
        {selectedRange && (
          <span>
            Selected: {selectedRange}
          </span>
        )}
        
        {count !== undefined && count > 1 && (
          <div className="flex items-center gap-3">
            <span>Count: {count}</span>
            {sum !== undefined && (
              <span>Sum: {sum.toLocaleString()}</span>
            )}
            {average !== undefined && (
              <span>Average: {average.toFixed(2)}</span>
            )}
          </div>
        )}
        
        {totalRows !== undefined && (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Rows:</span>
            <span className="text-gray-900 font-semibold">{totalRows.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Right side - Ready status */}
      <div className="flex items-center gap-2">
        <span className="text-green-600">Ready</span>
      </div>
    </div>
  );
}
