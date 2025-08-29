import React from "react";
import { 
  Save, 
  Scissors, 
  Copy, 
  ClipboardPaste, 
  Plus, 
  Minus, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Search 
} from "lucide-react";
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
    <div className="excel-toolbar bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 px-6 py-4 shadow-sm">
      <div className="flex items-center gap-4 flex-wrap">
        {/* File Operations */}
        <div className="flex items-center gap-3 pr-4 border-r border-blue-200">
          <Tooltip content="Save workbook (Ctrl+S)">
            <button
              onClick={onSave}
              disabled={readOnly}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              <Save size={16} />
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
              className="p-2.5 hover:bg-blue-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <Scissors size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Copy selected cell (Ctrl+C)">
            <button
              onClick={onCopy}
              className="p-2.5 hover:bg-blue-100 rounded-lg transition-all duration-200 text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <Copy size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Paste from clipboard (Ctrl+V)">
            <button
              onClick={onPaste}
              disabled={readOnly}
              className="p-2.5 hover:bg-blue-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <ClipboardPaste size={18} />
            </button>
          </Tooltip>
        </div>

        {/* Row Operations */}
        {!readOnly && (
          <div className="flex items-center gap-2 pr-4 border-r border-blue-200">
            <Tooltip content="Add a new row to the sheet">
              <button
                onClick={onAddRow}
                className="inline-flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 text-sm font-medium shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                <Plus size={16} />
                Add Row
              </button>
            </Tooltip>
            <Tooltip content="Delete selected row">
              <button
                onClick={onDeleteRow}
                className="inline-flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 text-sm font-medium shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                <Minus size={16} />
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
              className="p-2.5 hover:bg-blue-100 rounded-lg transition-all duration-200 text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <ArrowUp size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Sort column descending (Z-A, 9-1)">
            <button
              onClick={() => onSort && onSort("desc")}
              className="p-2.5 hover:bg-blue-100 rounded-lg transition-all duration-200 text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <ArrowDown size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Reset sort on the selected column">
            <button
              onClick={() => onSort && onSort("reset")}
              className="p-2.5 hover:bg-blue-100 rounded-lg transition-all duration-200 text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <RotateCcw size={18} />
            </button>
          </Tooltip>
          <Tooltip content="Filter data by value">
            <button
              onClick={onFilter}
              className="p-2.5 hover:bg-blue-100 rounded-lg transition-all duration-200 text-blue-700 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <Search size={18} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
