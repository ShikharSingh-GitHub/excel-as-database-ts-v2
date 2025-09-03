import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Settings,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";

interface ColumnConfig {
  path: string;
  type: string;
  coverage: number;
  visible: boolean;
  render: string;
  examples?: string[];
}

interface ChildTableConfig {
  path: string;
  type: string;
  coverage: number;
  primaryKey: string | null;
  visibleColumns: string[];
}

interface ColumnChooserProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnConfig[];
  childTables: ChildTableConfig[];
  onColumnToggle: (path: string, visible: boolean) => void;
  onRenderStrategyChange: (path: string, render: string) => void;
  onChildTableToggle: (path: string, visible: boolean) => void;
  onChildColumnToggle: (
    childPath: string,
    column: string,
    visible: boolean
  ) => void;
}

const ColumnChooser: React.FC<ColumnChooserProps> = ({
  isOpen,
  onClose,
  columns,
  childTables,
  onColumnToggle,
  onRenderStrategyChange,
  onChildTableToggle,
  onChildColumnToggle,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["columns"])
  );
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isOpen) {
      setExpandedSections(new Set(["columns"]));
      setSearchTerm("");
    }
  }, [isOpen]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const filteredColumns = columns.filter((col) =>
    col.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChildTables = childTables.filter((child) =>
    child.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStrategyOptions = [
    { value: "text", label: "Text" },
    { value: "join", label: "Join (arrays)" },
    { value: "length", label: "Length (arrays)" },
    { value: "json", label: "JSON Preview" },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Column Configuration
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder="Search columns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Regular Columns */}
          <div className="space-y-2">
            <button
              onClick={() => toggleSection("columns")}
              className="flex items-center gap-2 w-full text-left font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors">
              {expandedSections.has("columns") ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <Eye size={16} />
              Regular Columns ({filteredColumns.length})
            </button>

            {expandedSections.has("columns") && (
              <div className="ml-6 space-y-2">
                {filteredColumns.map((column) => (
                  <div
                    key={column.path}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <button
                      onClick={() =>
                        onColumnToggle(column.path, !column.visible)
                      }
                      className={`p-1 rounded transition-colors ${
                        column.visible
                          ? "text-blue-600 hover:text-blue-700"
                          : "text-gray-400 hover:text-gray-600"
                      }`}>
                      {column.visible ? (
                        <Eye size={16} />
                      ) : (
                        <EyeOff size={16} />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {column.path}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {column.type} • {(column.coverage * 100).toFixed(1)}%
                        coverage
                      </div>
                      {column.examples && column.examples.length > 0 && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Examples: {column.examples.slice(0, 2).join(", ")}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={column.render}
                        onChange={(e) =>
                          onRenderStrategyChange(column.path, e.target.value)
                        }
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100">
                        {renderStrategyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Child Tables */}
          {filteredChildTables.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => toggleSection("childTables")}
                className="flex items-center gap-2 w-full text-left font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors">
                {expandedSections.has("childTables") ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                <Settings size={16} />
                Child Tables ({filteredChildTables.length})
              </button>

              {expandedSections.has("childTables") && (
                <div className="ml-6 space-y-3">
                  {filteredChildTables.map((childTable) => (
                    <div
                      key={childTable.path}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            onChildTableToggle(
                              childTable.path,
                              !childTable.visible
                            )
                          }
                          className={`p-1 rounded transition-colors ${
                            childTable.visible
                              ? "text-blue-600 hover:text-blue-700"
                              : "text-gray-400 hover:text-gray-600"
                          }`}>
                          {childTable.visible ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {childTable.path}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {childTable.type} •{" "}
                            {(childTable.coverage * 100).toFixed(1)}% coverage
                            {childTable.primaryKey &&
                              ` • PK: ${childTable.primaryKey}`}
                          </div>
                        </div>
                      </div>

                      {childTable.visible && (
                        <div className="ml-8 space-y-2">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Visible Columns:
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {childTable.visibleColumns.map((column) => (
                              <label
                                key={column}
                                className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={true} // For now, all visible columns are checked
                                  onChange={(e) =>
                                    onChildColumnToggle(
                                      childTable.path,
                                      column,
                                      e.target.checked
                                    )
                                  }
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-gray-700 dark:text-gray-300 truncate">
                                  {column}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnChooser;
