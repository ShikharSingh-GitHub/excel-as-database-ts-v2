import React, { useMemo, useState, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  SortingState,
  ColumnFiltersState,
  ExpandedState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { JsonTableSchema, JsonTableRow, JsonColumn } from '../types/jsonViewer';

interface JsonTableProps {
  schema: JsonTableSchema;
  expandedRows: Set<string>;
  selectedRows: Set<string>;
  editingCell: { rowId: string; columnId: string } | null;
  onRowExpand: (rowId: string) => void;
  onRowCollapse: (rowId: string) => void;
  onRowSelect: (rowId: string, selected: boolean) => void;
  onCellEdit: (rowId: string, columnId: string) => void;
  onCellEditComplete: (rowId: string, columnId: string, value: any) => void;
  onRowDelete: (rowId: string) => void;
  readOnly?: boolean;
}

const JsonTable: React.FC<JsonTableProps> = ({
  schema,
  expandedRows,
  selectedRows,
  editingCell,
  onRowExpand,
  onRowCollapse,
  onRowSelect,
  onCellEdit,
  onCellEditComplete,
  onRowDelete,
  readOnly = false,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const columnHelper = createColumnHelper<JsonTableRow>();

  // Create columns
  const columns = useMemo(() => {
    const cols = [
      // Expand/Collapse column
      columnHelper.display({
        id: 'expand',
        header: '',
        cell: ({ row }) => {
          const hasExpandableData = schema.columns.some(col => col.isExpandable);
          if (!hasExpandableData) return null;

          const isExpanded = expandedRows.has(row.original.id);
          return (
            <button
              onClick={() => {
                if (isExpanded) {
                  onRowCollapse(row.original.id);
                } else {
                  onRowExpand(row.original.id);
                }
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          );
        },
        size: 40,
      }),
      // Select column
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="rounded border-gray-300"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-gray-300"
          />
        ),
        size: 40,
      }),
    ];

    // Add data columns
    schema.columns.forEach((column) => {
      cols.push(
        columnHelper.accessor(column.key, {
          id: column.id,
          header: ({ column: col }) => (
            <div className="flex items-center gap-2">
              <button
                onClick={col.getToggleSortingHandler()}
                className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded">
                {column.label}
                {col.getIsSorted() === 'asc' ? '↑' : col.getIsSorted() === 'desc' ? '↓' : ''}
              </button>
            </div>
          ),
          cell: ({ getValue, row, column: col }) => {
            const value = getValue();
            const isEditing = editingCell?.rowId === row.original.id && editingCell?.columnId === col.id;
            
            if (isEditing && !readOnly) {
              return (
                <EditableCell
                  value={value}
                  column={column}
                  onSave={(newValue) => onCellEditComplete(row.original.id, col.id, newValue)}
                  onCancel={() => onCellEditComplete(row.original.id, col.id, value)}
                />
              );
            }

            return (
              <div
                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => {
                  if (!readOnly && column.isEditable) {
                    onCellEdit(row.original.id, col.id);
                  }
                }}>
                <CellValue value={value} column={column} />
              </div>
            );
          },
          enableSorting: column.sortable,
          enableColumnFilter: column.filterable,
        })
      );
    });

    // Actions column
    if (!readOnly) {
      cols.push(
        columnHelper.display({
          id: 'actions',
          header: 'Actions',
          cell: ({ row }) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRowDelete(row.original.id)}
                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ),
          size: 80,
        })
      );
    }

    return cols;
  }, [schema.columns, expandedRows, editingCell, readOnly, onRowExpand, onRowCollapse, onCellEdit, onCellEditComplete, onRowDelete]);

  const table = useReactTable({
    data: schema.data,
    columns,
    state: {
      sorting,
      columnFilters,
      expanded,
      rowSelection: {},
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: true,
  });

  return (
    <div className="h-full flex flex-col">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700"
                    style={{ width: header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {/* Expanded row content */}
                {expandedRows.has(row.original.id) && (
                  <tr>
                    <td colSpan={columns.length} className="px-4 py-3 bg-gray-50 dark:bg-gray-800">
                      <ExpandedRowContent row={row.original} schema={schema} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Info */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
        Showing {table.getFilteredRowModel().rows.length} of {schema.data.length} rows
      </div>
    </div>
  );
};

// Editable Cell Component
interface EditableCellProps {
  value: any;
  column: JsonColumn;
  onSave: (value: any) => void;
  onCancel: () => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, column, onSave, onCancel }) => {
  const [editValue, setEditValue] = useState(String(value || ''));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(parseValue(editValue, column.type));
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const parseValue = (val: string, type: string): any => {
    if (type === 'number') return Number(val);
    if (type === 'boolean') return val === 'true';
    if (type === 'null') return null;
    return val;
  };

  return (
    <input
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(parseValue(editValue, column.type))}
      className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      autoFocus
    />
  );
};

// Cell Value Component
interface CellValueProps {
  value: any;
  column: JsonColumn;
}

const CellValue: React.FC<CellValueProps> = ({ value, column }) => {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">null</span>;
  }

  if (column.type === 'object') {
    return <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>;
  }

  if (column.type === 'array') {
    return <span className="text-green-600 dark:text-green-400">{String(value)}</span>;
  }

  if (column.type === 'boolean') {
    return (
      <span className={`px-2 py-1 rounded text-xs ${
        value ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }`}>
        {String(value)}
      </span>
    );
  }

  return <span>{String(value)}</span>;
};

// Expanded Row Content Component
interface ExpandedRowContentProps {
  row: JsonTableRow;
  schema: JsonTableSchema;
}

const ExpandedRowContent: React.FC<ExpandedRowContentProps> = ({ row, schema }) => {
  const expandableColumns = schema.columns.filter(col => col.isExpandable);
  
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900 dark:text-gray-100">Expanded Data</h4>
      {expandableColumns.map((column) => {
        const value = row.data[column.key];
        return (
          <div key={column.id} className="border-l-4 border-blue-500 pl-4">
            <h5 className="font-medium text-gray-700 dark:text-gray-300">{column.label}</h5>
            <pre className="mt-1 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto">
              {JSON.stringify(value, null, 2)}
            </pre>
          </div>
        );
      })}
    </div>
  );
};

export default JsonTable;
