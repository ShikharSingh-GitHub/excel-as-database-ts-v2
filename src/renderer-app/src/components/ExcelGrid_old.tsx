import React, { useState, useCallback, useRef, useEffect } from "react";

interface CellPosition {
  row: number;
  col: number;
}

interface ExcelGridProps {
  headers: string[];
  rows: any[];
  onCellEdit?: (rowIndex: number, colKey: string, value: any) => void;
  onRowAdd?: () => void;
  onRowDelete?: (rowIndex: number) => void;
  readOnly?: boolean;
  selectedCell?: CellPosition | null;
  onCellSelect?: (position: CellPosition | null) => void;
  sortState?: { column: string; direction: 'asc' | 'desc' };
  onSort?: (column: string) => void;
}

const DEFAULT_COLUMN_WIDTH = 120;
const MIN_COLUMN_WIDTH = 60;

// Convert number to Excel column letter (A, B, C, ... Z, AA, AB, etc.)
function numberToColumnLetter(num: number): string {
  let result = '';
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26) - 1;
  }
  return result;
}

export default function ExcelGrid({
  headers = [],
  rows = [],
  onCellEdit,
  onRowAdd,
  onRowDelete,
  readOnly = false,
  selectedCell,
  onCellSelect,
  sortState,
  onSort,
}: ExcelGridProps) {
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [selection, setSelection] = useState<{
    start: CellPosition;
    end: CellPosition;
  } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  
  const editInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Handle cell click
  const handleCellClick = useCallback((row: number, col: number, event: React.MouseEvent) => {
    event.preventDefault();
    const position = { row, col };
    
    if (event.shiftKey && selectedCell) {
      // Extend selection
      setSelection({
        start: selectedCell,
        end: position
      });
    } else {
      // Single cell selection
      setSelection(null);
      onCellSelect?.(position);
    }
  }, [selectedCell, onCellSelect]);

  // Handle cell double click to start editing
  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    if (readOnly) return;
    
    const position = { row, col };
    setEditingCell(position);
    const currentValue = rows[row]?.[headers[col]] || "";
    setEditValue(String(currentValue));
  }, [readOnly, rows, headers]);

  // Handle key press for editing
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!selectedCell) return;

    const { row, col } = selectedCell;

    switch (event.key) {
      case 'Enter':
        if (editingCell) {
          // Commit edit
          const colKey = headers[editingCell.col];
          onCellEdit?.(editingCell.row, colKey, editValue);
          setEditingCell(null);
          
          // Move to next row
          const nextRow = Math.min(row + 1, rows.length - 1);
          onCellSelect?.({ row: nextRow, col });
        } else {
          // Start editing
          handleCellDoubleClick(row, col);
        }
        event.preventDefault();
        break;
        
      case 'Escape':
        if (editingCell) {
          setEditingCell(null);
          event.preventDefault();
        }
        break;
        
      case 'Tab':
        if (editingCell) {
          // Commit edit and move to next cell
          const colKey = headers[editingCell.col];
          onCellEdit?.(editingCell.row, colKey, editValue);
          setEditingCell(null);
        }
        
        const nextCol = event.shiftKey 
          ? Math.max(0, col - 1)
          : Math.min(headers.length - 1, col + 1);
        onCellSelect?.({ row, col: nextCol });
        event.preventDefault();
        break;
        
      case 'ArrowUp':
        if (!editingCell) {
          const nextRow = Math.max(0, row - 1);
          onCellSelect?.({ row: nextRow, col });
          event.preventDefault();
        }
        break;
        
      case 'ArrowDown':
        if (!editingCell) {
          const nextRow = Math.min(rows.length - 1, row + 1);
          onCellSelect?.({ row: nextRow, col });
          event.preventDefault();
        }
        break;
        
      case 'ArrowLeft':
        if (!editingCell) {
          const nextCol = Math.max(0, col - 1);
          onCellSelect?.({ row, col: nextCol });
          event.preventDefault();
        }
        break;
        
      case 'ArrowRight':
        if (!editingCell) {
          const nextCol = Math.min(headers.length - 1, col + 1);
          onCellSelect?.({ row, col: nextCol });
          event.preventDefault();
        }
        break;
        
      case 'Delete':
      case 'Backspace':
        if (!editingCell && !readOnly) {
          // Clear cell content
          const colKey = headers[col];
          onCellEdit?.(row, colKey, "");
          event.preventDefault();
        }
        break;
        
      case 'F2':
        if (!editingCell) {
          handleCellDoubleClick(row, col);
          event.preventDefault();
        }
        break;
        
      default:
        // Start typing to edit cell
        if (!editingCell && !readOnly && event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setEditingCell({ row, col });
          setEditValue(event.key);
          event.preventDefault();
        }
        break;
    }
  }, [selectedCell, editingCell, editValue, headers, rows, onCellEdit, onCellSelect, readOnly, handleCellDoubleClick]);

  // Focus management
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Check if cell is selected
  const isCellSelected = useCallback((row: number, col: number) => {
    if (selection) {
      const minRow = Math.min(selection.start.row, selection.end.row);
      const maxRow = Math.max(selection.start.row, selection.end.row);
      const minCol = Math.min(selection.start.col, selection.end.col);
      const maxCol = Math.max(selection.start.col, selection.end.col);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    }
    return selectedCell?.row === row && selectedCell?.col === col;
  }, [selectedCell, selection]);

  // Check if cell is being edited
  const isCellEditing = useCallback((row: number, col: number) => {
    return editingCell?.row === row && editingCell?.col === col;
  }, [editingCell]);

  // Handle column resize
  const handleMouseDown = useCallback((e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    setResizingColumn(colIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[colIndex] || DEFAULT_COLUMN_WIDTH);
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (resizingColumn === null) return;
    
    const deltaX = e.clientX - resizeStartX;
    const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth + deltaX);
    
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }));
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleMouseUp = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // Add global mouse event listeners for column resizing
  useEffect(() => {
    if (resizingColumn !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingColumn, handleMouseMove, handleMouseUp]);

  // Focus management
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Check if cell is selected
  const isCellSelected = useCallback((row: number, col: number) => {
    if (selection) {
      const minRow = Math.min(selection.start.row, selection.end.row);
      const maxRow = Math.max(selection.start.row, selection.end.row);
      const minCol = Math.min(selection.start.col, selection.end.col);
      const maxCol = Math.max(selection.start.col, selection.end.col);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    }
    return selectedCell?.row === row && selectedCell?.col === col;
  }, [selectedCell, selection]);

  // Check if cell is being edited
  const isCellEditing = useCallback((row: number, col: number) => {
    return editingCell?.row === row && editingCell?.col === col;
  }, [editingCell]);

  // Handle sort
  const handleSort = useCallback((column: string) => {
    onSort?.(column);
  }, [onSort]);

  return (
    <div className="excel-grid flex-1 overflow-hidden bg-gradient-to-br from-white to-gray-50">
      <div className="h-full overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-gray-100 to-gray-200 border-b border-gray-300 shadow-sm">
              <th className="w-12 px-2 py-2 text-center text-xs font-semibold text-gray-700 bg-gradient-to-b from-gray-100 to-gray-200 border-r border-gray-300">
                #
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td className="w-12 px-2 py-2 text-center text-xs font-medium text-gray-700 border-r border-gray-300">
                {rowIndex + 1}
              </td>
              {headers.map((header, colIndex) => {
                const isSelected = isCellSelected(rowIndex, colIndex);
                const isEditing = isCellEditing(rowIndex, colIndex);
                const cellValue = row[header] || "";
                
                return (
                  <td
                    key={header}
                    className={`px-3 py-2 text-left text-xs font-medium text-gray-700 border-r border-gray-300 ${
                      isSelected ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'
                    } ${isEditing ? 'bg-white' : ''}`}
                    style={{ width: columnWidths[colIndex] || DEFAULT_COLUMN_WIDTH }}
                    onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                    onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                  >
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          const colKey = headers[colIndex];
                          onCellEdit?.(rowIndex, colKey, editValue);
                          setEditingCell(null);
                        }}
                        className="w-full h-full border-none outline-none bg-transparent text-xs"
                      />
                    ) : (
                      <span className="truncate w-full">
                        {String(cellValue)}
                      </span>
                    )}
                    
                    {/* Selection border */}
                    {isSelected && !isEditing && (
                      <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
