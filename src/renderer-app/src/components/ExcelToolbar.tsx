import {
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  Copy,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  Search,
} from "lucide-react";
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
    <div className="excel-toolbar bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border-b border-blue-200 dark:border-gray-700 px-4 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* File Operations */}
        <div className="flex items-center gap-3 pr-4 border-r border-blue-200">
          <Tooltip content="Save workbook (Ctrl+S)">
            <button
              onClick={onSave}
              disabled={readOnly}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-600 dark:to-blue-800 text-white rounded-md hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <Save size={14} />
              Save
            </button>
          </Tooltip>
        </div>

        {/* Clipboard Operations */}
        <div className="flex items-center gap-2 pr-4 border-r border-blue-200">
          <Tooltip content="Cut selected cell (Ctrl+X)">
            <button
              onClick={onCut}
              disabled={readOnly}
              className="p-2 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 text-blue-700 dark:text-gray-200 hover:text-blue-800 dark:hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <Scissors size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Copy selected cell (Ctrl+C)">
            <button
              onClick={onCopy}
              className="p-2 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-md transition-all duration-150 text-blue-700 dark:text-gray-200 hover:text-blue-800 dark:hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <Copy size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Paste from clipboard (Ctrl+V)">
            <button
              onClick={onPaste}
              disabled={readOnly}
              className="p-2 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 text-blue-700 dark:text-gray-200 hover:text-blue-800 dark:hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <ClipboardPaste size={16} />
            </button>
          </Tooltip>
        </div>

        {/* Row Operations */}
        {!readOnly && (
          <div className="flex items-center gap-2 pr-4 border-r border-blue-200">
            <Tooltip content="Add a new row to the sheet">
              <button
                onClick={onAddRow}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 text-white rounded-md hover:from-green-700 hover:to-green-800 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1">
                <Plus size={14} />
                Add Row
              </button>
            </Tooltip>
            <Tooltip content="Delete selected row">
              <button
                onClick={onDeleteRow}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800 text-white rounded-md hover:from-red-700 hover:to-red-800 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1">
                <Minus size={14} />
                Delete Row
              </button>
            </Tooltip>
          </div>
        )}

        {/* Sort & Filter */}
        <div className="flex items-center gap-2">
          <Tooltip content="Sort column ascending (A-Z, 1-9)">
            <button
              onClick={() => onSort && onSort("asc")}
              className="p-2 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-md transition-all duration-150 text-blue-700 dark:text-gray-200 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <ArrowUp size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Sort column descending (Z-A, 9-1)">
            <button
              onClick={() => onSort && onSort("desc")}
              className="p-2 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-md transition-all duration-150 text-blue-700 dark:text-gray-200 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <ArrowDown size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Reset sort on the selected column">
            <button
              onClick={() => onSort && onSort("reset")}
              className="p-2 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-md transition-all duration-150 text-blue-700 dark:text-gray-200 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <RotateCcw size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Filter data by value">
            <button
              onClick={onFilter}
              className="p-2 hover:bg-blue-100 dark:hover:bg-gray-800 rounded-md transition-all duration-150 text-blue-700 dark:text-gray-200 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <Search size={16} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
