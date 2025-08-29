import React, { useCallback, useEffect, useRef, useState } from "react";

interface CellPosition {
  row: number;
  col: number;
}

interface ExcelGridProps {
  headers: string[];
  rows: any[];
  hiddenColumns?: Record<string, boolean>;
  startIndex?: number;
  onCellEdit?: (rowIndex: number, colKey: string, value: any) => void;
  onRowAdd?: (position?: number) => void;
  onRowDelete?: (rowIndex: number) => void;
  readOnly?: boolean;
  selectedCell?: CellPosition | null;
  onCellSelect?: (position: CellPosition | null) => void;
  sortState?: { column: string; direction: "asc" | "desc" };
  onSort?: (column: string) => void;
  onRequestContextMenu?: (
    x: number,
    y: number,
    opts?: { rowIndex?: number; colIndex?: number; header?: string }
  ) => void;
}

const DEFAULT_COLUMN_WIDTH = 120;
const MIN_COLUMN_WIDTH = 60;

export default function ExcelGrid({
  headers = [],
  rows = [],
  hiddenColumns = {},
  onCellEdit,
  onRowAdd,
  onRowDelete,
  readOnly = false,
  startIndex = 0,
  selectedCell,
  onCellSelect,
  sortState,
  onSort,
  onRequestContextMenu,
}: ExcelGridProps) {
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex?: number;
  } | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  // Handle cell click
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      onCellSelect?.({ row, col });
    },
    [onCellSelect]
  );

  // Handle cell double click to start editing
  const handleCellDoubleClick = useCallback(
    (row: number, col: number) => {
      if (!readOnly) {
        setEditingCell({ row, col });
        const cellValue = rows[row]?.[headers[col]] || "";
        setEditValue(String(cellValue));
      }
    },
    [readOnly, rows, headers]
  );

  // Handle sort
  const handleSort = useCallback(
    (column: string) => {
      onSort?.(column);
    },
    [onSort]
  );

  // Column resize handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      setResizingColumn(colIndex);
      setResizeStartX(e.clientX);
      setResizeStartWidth(columnWidths[colIndex] || DEFAULT_COLUMN_WIDTH);
    },
    [columnWidths]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (resizingColumn === null) return;

      const deltaX = e.clientX - resizeStartX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth + deltaX);

      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    },
    [resizingColumn, resizeStartX, resizeStartWidth]
  );

  const handleMouseUp = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // Add global mouse event listeners for column resizing
  useEffect(() => {
    if (resizingColumn !== null) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [resizingColumn, handleMouseMove, handleMouseUp]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Focus management
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Check if cell is selected
  const isCellSelected = useCallback(
    (row: number, col: number) => {
      return selectedCell?.row === row && selectedCell?.col === col;
    },
    [selectedCell]
  );

  // Check if cell is being edited
  const isCellEditing = useCallback(
    (row: number, col: number) => {
      return editingCell?.row === row && editingCell?.col === col;
    },
    [editingCell]
  );

  // Handle context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, rowIndex?: number, colIndex?: number) => {
      e.preventDefault();
      if (typeof onRequestContextMenu === "function") {
        onRequestContextMenu(e.clientX, e.clientY, {
          rowIndex,
          colIndex,
          header: typeof colIndex === "number" ? headers[colIndex] : undefined,
        });
        return;
      }
      setContextMenu({ x: e.clientX, y: e.clientY, rowIndex });
    },
    [onRequestContextMenu, headers]
  );

  // Handle row operations
  const handleAddRowAbove = useCallback(
    (position: number) => {
      onRowAdd?.(position);
      setContextMenu(null);
    },
    [onRowAdd]
  );

  const handleAddRowBelow = useCallback(
    (position: number) => {
      onRowAdd?.(position + 1);
      setContextMenu(null);
    },
    [onRowAdd]
  );

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      onRowDelete?.(rowIndex);
      setContextMenu(null);
    },
    [onRowDelete]
  );

  return (
    <div className="excel-grid h-full flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:to-gray-900">
      <div
        className="flex-1 min-h-0 overflow-y-auto pb-16 custom-scrollbar h-full"
        style={{
          height: "100%",
          scrollbarWidth: "thin",
          scrollbarColor: "#3b82f6 #dbeafe",
        }}>
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:bg-gradient-to-r dark:from-blue-900 dark:to-blue-800 dark:border-b dark:border-gray-700 border-b border-blue-300 shadow-sm">
              <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none transition-all duration-200">
                <span title="Row number">#</span>
              </th>
              {headers
                .filter((h) => !hiddenColumns[h])
                .map((header, index) => (
                  <th
                    key={header}
                    className={`relative px-3 py-3 text-left text-xs font-semibold text-blue-800 dark:text-blue-200 bg-gradient-to-b from-blue-100 to-blue-200 dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 border-r border-blue-300 dark:border-gray-700 select-none cursor-pointer hover:bg-gradient-to-b hover:from-blue-200 hover:to-blue-300 dark:hover:bg-blue-800 transition-all duration-200 ${
                      sortState?.column === header
                        ? "bg-gradient-to-b from-blue-200 to-blue-300 text-blue-900 shadow-sm dark:bg-gradient-to-b dark:from-blue-900 dark:to-blue-800 dark:text-blue-200"
                        : ""
                    }`}
                    style={{
                      width: columnWidths[index] || DEFAULT_COLUMN_WIDTH,
                    }}
                    onClick={() => handleSort(header)}
                    onContextMenu={(e) =>
                      handleContextMenu(e, undefined, index)
                    }>
                    <div className="flex items-center justify-between">
                      <span className="truncate font-medium">{header}</span>
                      {sortState?.column === header && (
                        <span
                          className="ml-1 text-blue-700 dark:text-blue-300 font-bold"
                          title={
                            sortState.direction === "asc"
                              ? "Sorted ascending"
                              : "Sorted descending"
                          }>
                          {sortState.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>

                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400 opacity-0 hover:opacity-100 transition-opacity duration-200"
                      onMouseDown={(e) => handleMouseDown(e, index)}
                      style={{ zIndex: 1000 }}
                    />
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-blue-50/30 dark:hover:bg-blue-800 transition-colors"
                onContextMenu={(e) => handleContextMenu(e, rowIndex)}>
                <td className="w-12 px-2 py-2 text-center text-xs font-medium text-gray-700 dark:text-blue-100 bg-gray-50 dark:bg-blue-900/10 border-r border-gray-300 dark:border-gray-700">
                  {startIndex + rowIndex + 1}
                </td>
                {headers
                  .filter((h) => !hiddenColumns[h])
                  .map((header, colIndex) => {
                    const isSelected = isCellSelected(rowIndex, colIndex);
                    const isEditing = isCellEditing(rowIndex, colIndex);
                    const cellValue = row[header] || "";

                    return (
                      <td
                        key={header}
                        className={`relative px-3 py-2.5 text-sm border-r border-blue-200/50 border-b border-blue-200/50 dark:border-gray-700 cursor-cell transition-all duration-200 ${
                          isSelected
                            ? "bg-blue-100 ring-2 ring-blue-500 ring-inset shadow-sm dark:bg-blue-800"
                            : "hover:bg-blue-50/50 dark:hover:bg-blue-800"
                        } ${
                          isEditing
                            ? "bg-white shadow-sm dark:bg-blue-900/20"
                            : ""
                        }`}
                        style={{
                          width: columnWidths[colIndex] || DEFAULT_COLUMN_WIDTH,
                        }}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, colIndex)
                        }>
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => {
                              try {
                                const colKey = headers[colIndex];
                                onCellEdit?.(rowIndex, colKey, editValue);
                              } catch (error) {
                                console.error("Error saving cell edit:", error);
                              } finally {
                                setEditingCell(null);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                try {
                                  const colKey = headers[colIndex];
                                  onCellEdit?.(rowIndex, colKey, editValue);
                                } catch (error) {
                                  console.error(
                                    "Error saving cell edit:",
                                    error
                                  );
                                } finally {
                                  setEditingCell(null);
                                }
                              } else if (e.key === "Escape") {
                                setEditingCell(null);
                              }
                            }}
                            className="w-full h-full border-none outline-none bg-transparent text-sm"
                          />
                        ) : (
                          <span className="truncate block w-full text-gray-900 dark:text-gray-100">
                            {String(cellValue)}
                          </span>
                        )}
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50 text-gray-900 dark:text-gray-100"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}>
          <button
            onClick={() =>
              contextMenu.rowIndex !== undefined
                ? handleAddRowAbove(contextMenu.rowIndex)
                : onRowAdd?.()
            }
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
            ➕ Add Row Above
          </button>
          <button
            onClick={() =>
              contextMenu.rowIndex !== undefined
                ? handleAddRowBelow(contextMenu.rowIndex)
                : onRowAdd?.()
            }
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
            ➕ Add Row Below
          </button>
          {contextMenu.rowIndex !== undefined && (
            <button
              onClick={() => handleDeleteRow(contextMenu.rowIndex!)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-2">
              🗑️ Delete Row
            </button>
          )}
        </div>
      )}
    </div>
  );
}
