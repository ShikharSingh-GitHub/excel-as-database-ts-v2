import React, { useEffect, useRef, useState } from "react";
import Tooltip from "./Tooltip";

interface FormulaBarProps {
  selectedCell?: { row: number; col: number } | null;
  cellValue?: string;
  onCellValueChange?: (value: string) => void;
  headers?: string[];
}

// Convert number to Excel column letter (A, B, C, ... Z, AA, AB, etc.)
function numberToColumnLetter(num: number): string {
  let result = "";
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

export default function FormulaBar({
  selectedCell,
  cellValue = "",
  onCellValueChange,
  headers = [],
}: FormulaBarProps) {
  const [editValue, setEditValue] = useState(cellValue);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when cell value changes
  useEffect(() => {
    setEditValue(cellValue);
  }, [cellValue]);

  // Get cell reference (e.g., "A1", "B2")
  const getCellReference = () => {
    if (!selectedCell) return "";
    const col = numberToColumnLetter(selectedCell.col);
    const row = selectedCell.row + 1;
    return `${col}${row}`;
  };

  // Handle input focus
  const handleFocus = () => {
    setIsEditing(true);
  };

  // Handle input blur
  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== cellValue) {
      onCellValueChange?.(editValue);
    }
  };

  // Handle Enter key
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      inputRef.current?.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditValue(cellValue);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="formula-bar bg-white/95 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 p-3 flex items-center gap-3 shadow-sm text-gray-800 dark:text-gray-200">
      {/* Cell Reference */}
      <div className="flex items-center gap-3">
        <div className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 text-center font-medium dark:text-gray-100">
          {getCellReference() || "No Cell"}
        </div>
      </div>

      {/* Function Button */}
      <Tooltip content="Insert function">
        <button className="px-3 h-full border-r border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200">
          fx
        </button>
      </Tooltip>

      {/* Formula Input */}
      <div className="flex-1 flex items-center gap-2">
        <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono text-sm font-bold dark:bg-blue-900 dark:text-blue-200">
          fx
        </div>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all"
          placeholder="Enter formula or value..."
        />
      </div>
      {isEditing && (
        <div className="flex items-center border-l border-gray-300">
          <Tooltip content="Accept changes">
            <button
              onClick={() => {
                onCellValueChange?.(editValue);
                setIsEditing(false);
              }}
              className="px-2 h-full hover:bg-green-50 dark:hover:bg-green-900 text-green-600 dark:text-green-200">
              ✓
            </button>
          </Tooltip>
          <Tooltip content="Cancel changes">
            <button
              onClick={() => {
                setEditValue(cellValue);
                setIsEditing(false);
                inputRef.current?.blur();
              }}
              className="px-2 h-full hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-200">
              ✕
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
