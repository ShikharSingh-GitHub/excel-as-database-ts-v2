import React from "react";
import Tooltip from "./Tooltip";

interface ExcelToolbarProps {
  onSave?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
  onAddRow?: () => void;
  onDeleteRow?: () => void;
  onSort?: (direction: "asc" | "desc" | "reset") => void;
  onFilter?: () => void;
  readOnly?: boolean;
}

export default function ExcelToolbar({
  onSave,
  onCopy,
  onPaste,
  onCut,
  onAddRow,
  onDeleteRow,
  onSort,
  onFilter,
  readOnly = false,
}: ExcelToolbarProps) {
  return (
    <div className="excel-toolbar bg-white/90 backdrop-blur-sm border-b border-gray-200/50 p-3 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        {/* File Operations */}
        <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
          <Tooltip content="Save workbook (Ctrl+S)">
            <button
              onClick={onSave}
              disabled={readOnly}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all duration-200">
              💾 Save
            </button>
          </Tooltip>
        </div>

        {/* Clipboard Operations */}
        <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
          <Tooltip content="Cut selected cell (Ctrl+X)">
            <button
              onClick={onCut}
              disabled={readOnly}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <span className="text-base">✂️</span>
            </button>
          </Tooltip>
          <Tooltip content="Copy selected cell (Ctrl+C)">
            <button
              onClick={onCopy}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-base">📋</span>
            </button>
          </Tooltip>
          <Tooltip content="Paste from clipboard (Ctrl+V)">
            <button
              onClick={onPaste}
              disabled={readOnly}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <span className="text-base">📄</span>
            </button>
          </Tooltip>
        </div>

        {/* Row Operations */}
        {!readOnly && (
          <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
            <Tooltip content="Add a new row to the sheet">
              <button
                onClick={onAddRow}
                className="px-3 py-2 hover:bg-green-50 hover:text-green-700 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors border border-transparent hover:border-green-200">
                <span className="text-base">➕</span>
                Add Row
              </button>
            </Tooltip>
            <Tooltip content="Delete the selected row">
              <button
                onClick={onDeleteRow}
                className="px-3 py-2 hover:bg-red-50 hover:text-red-700 rounded-lg text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors border border-transparent hover:border-red-200">
                <span className="text-base">➖</span>
                Delete Row
              </button>
            </Tooltip>
          </div>
        )}

        {/* Sort & Filter */}
        <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
          <Tooltip content="Sort column ascending (A-Z, 1-9)">
            <button
              onClick={() => onSort && onSort("asc")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-base">🔼</span>
            </button>
          </Tooltip>
          <Tooltip content="Sort column descending (Z-A, 9-1)">
            <button
              onClick={() => onSort && onSort("desc")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-base">🔽</span>
            </button>
          </Tooltip>
          <Tooltip content="Reset sort on the selected column">
            <button
              onClick={() => onSort && onSort("reset")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-base">⟲</span>
            </button>
          </Tooltip>
          <Tooltip content="Filter data by value">
            <button
              onClick={onFilter}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <span className="text-base">🔍</span>
            </button>
          </Tooltip>
        </div>

      </div>
    </div>
  );
}
