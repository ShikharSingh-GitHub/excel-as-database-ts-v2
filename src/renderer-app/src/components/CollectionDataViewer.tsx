import {
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  Plus,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Toast from "./Toast";

interface CollectionDataViewerProps {
  fileName: string;
}

interface Collection {
  name: string;
  count: number;
  columns: string[];
}

interface CollectionRow {
  id: string;
  _version: number;
  _created_at: string;
  _updated_at: string;
  [key: string]: any;
}

const CollectionDataViewer: React.FC<CollectionDataViewerProps> = ({
  fileName,
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load available collections
  useEffect(() => {
    loadCollections();
  }, [fileName]);

  // Load collection data when active collection changes
  useEffect(() => {
    if (activeCollection) {
      loadCollectionData(activeCollection);
    }
  }, [activeCollection]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if collections exist for this dataset
      const hasCollections = await (window as any).api.normalize.hasCollections(
        fileName
      );

      if (!hasCollections) {
        // Auto-normalize the JSON file
        await normalizeJsonFile();
      }

      // Load collection metadata
      const expectedCollections = [
        "pages",
        "page_elements",
        "testsets",
        "testcases",
        "steps",
        "application",
      ];

      const collectionList: Collection[] = [];
      for (const collectionName of expectedCollections) {
        try {
          const meta = await (window as any).api.collection.meta(
            collectionName
          );
          if (meta && meta.count > 0 && Array.isArray(meta.columns)) {
            collectionList.push({
              name: collectionName,
              count: meta.count,
              columns: meta.columns,
            });
          }
        } catch (e) {
          console.warn(`Failed to load collection ${collectionName}:`, e);
        }
      }

      setCollections(collectionList);

      // Set first collection as active
      if (collectionList.length > 0) {
        setActiveCollection(collectionList[0].name);
        setToast(`✅ Loaded ${collectionList.length} collections`);
      } else {
        setToast("ℹ️ No collections found in this JSON file");
      }
    } catch (err) {
      setError(`Failed to load collections: ${err}`);
      setToast(`❌ Failed to load collections: ${err}`);
      console.error("Error loading collections:", err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeJsonFile = async () => {
    try {
      // Read the JSON file and normalize it
      const jsonData = await (window as any).api.json.read(fileName, "default");
      if (jsonData.rawData) {
        await (window as any).api.normalize.json(jsonData.rawData, fileName);
      }
    } catch (err) {
      console.error("Failed to normalize JSON file:", err);
      throw err;
    }
  };

  const loadCollectionData = async (collectionName: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await (window as any).api.collection.list({
        collection: collectionName,
      });

      // Ensure data is an array and filter out invalid rows
      const validData = Array.isArray(data)
        ? data.filter((row) => row && row.id && typeof row.id === "string")
        : [];

      console.log(
        `Loaded ${validData.length} valid rows for ${collectionName}`
      );
      setCollectionData(validData);

      if (validData.length === 0) {
        setToast(`ℹ️ No data found in ${collectionName} collection`);
      } else {
        setToast(`✅ Loaded ${validData.length} rows from ${collectionName}`);
      }
    } catch (err) {
      setError(`Failed to load ${collectionName}: ${err}`);
      setToast(`❌ Failed to load ${collectionName}: ${err}`);
      console.error(`Error loading collection ${collectionName}:`, err);
      setCollectionData([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = async () => {
    if (!activeCollection) return;

    try {
      const newRow = {
        // Add default values based on collection type
        ...getDefaultRowForCollection(activeCollection),
      };

      const result = await (window as any).api.collection.create({
        collection: activeCollection,
        row: newRow,
      });

      if (result.error) {
        setError(`Failed to add row: ${result.message}`);
        setToast(`❌ Failed to add row: ${result.message}`);
        return;
      }

      setToast("✅ Row added successfully");
      // Reload collection data
      await loadCollectionData(activeCollection);
    } catch (err) {
      setError(`Failed to add row: ${err}`);
      setToast(`❌ Failed to add row: ${err}`);
      console.error("Error adding row:", err);
    }
  };

  const handleUpdateRow = async (rowId: string, field: string, value: any) => {
    if (!activeCollection) return;

    try {
      const row = collectionData.find((r) => r.id === rowId);
      if (!row) return;

      const result = await (window as any).api.collection.update({
        collection: activeCollection,
        id: rowId,
        expectedVersion: row._version,
        patch: { [field]: value },
      });

      if (result.error) {
        if (result.conflict) {
          setError("Conflict detected. Please refresh and try again.");
          setToast("❌ Conflict detected. Please refresh and try again.");
        } else {
          setError(`Failed to update row: ${result.message}`);
          setToast(`❌ Failed to update row: ${result.message}`);
        }
        return;
      }

      setToast("✅ Row updated successfully");
      // Update local data
      setCollectionData((prev) =>
        prev.map((r) => (r.id === rowId ? result.row : r))
      );
    } catch (err) {
      setError(`Failed to update row: ${err}`);
      setToast(`❌ Failed to update row: ${err}`);
      console.error("Error updating row:", err);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!activeCollection) return;

    try {
      const row = collectionData.find((r) => r.id === rowId);
      if (!row) return;

      const result = await (window as any).api.collection.delete({
        collection: activeCollection,
        id: rowId,
        expectedVersion: row._version,
      });

      if (result.error) {
        if (result.conflict) {
          setError("Conflict detected. Please refresh and try again.");
          setToast("❌ Conflict detected. Please refresh and try again.");
        } else {
          setError(`Failed to delete row: ${result.message}`);
          setToast(`❌ Failed to delete row: ${result.message}`);
        }
        return;
      }

      setToast("✅ Row deleted successfully");
      // Update local data
      setCollectionData((prev) => prev.filter((r) => r.id !== rowId));
    } catch (err) {
      setError(`Failed to delete row: ${err}`);
      setToast(`❌ Failed to delete row: ${err}`);
      console.error("Error deleting row:", err);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);

      // Generate export filename
      const baseName =
        fileName.split("/").pop()?.replace(".json", "") || "export";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const exportFileName = `${baseName}_export_${timestamp}.json`;

      // Get the folder path from config
      const config = await (window as any).api.config.get();
      const folderPath =
        config.folderPath || "/Users/shikhar/Developer/workbook";
      const exportPath = `${folderPath}/${exportFileName}`;

      // Export the JSON
      const result = await (window as any).api.json.export(
        fileName,
        exportPath
      );

      if (result.error) {
        setError(`Export failed: ${result.message}`);
        setToast(`❌ Export failed: ${result.message}`);
        return;
      }

      // Show success message
      setError(null);
      setToast(`✅ JSON exported successfully to: ${result.path}`);
    } catch (err) {
      setError(`Export failed: ${err}`);
      setToast(`❌ Export failed: ${err}`);
      console.error("Error exporting JSON:", err);
    } finally {
      setExporting(false);
    }
  };

  const getDefaultRowForCollection = (collectionName: string): any => {
    const defaults: Record<string, any> = {
      pages: {
        pageName: "New Page",
        status: "Active",
        navigationType: "URL",
        navigationValue: "",
      },
      page_elements: {
        elementName: "New Element",
        elementType: "Text",
        locatorType: "XPATH",
        locatorValue: "",
        isPageIdentifier: false,
        status: "Active",
        eventName: "",
      },
      testsets: {
        name: "New Test Set",
        status: "Active",
        appId: 1,
        seqId: 1,
      },
      testcases: {
        name: "New Test Case",
        status: "Active",
        seqId: 1,
      },
      steps: {
        type: "Given",
        text: "New Step",
        status: "Active",
        seqId: 1,
      },
      application: {
        userName: "New User",
        versionNumber: "1.0",
      },
    };

    return defaults[collectionName] || {};
  };

  const getDisplayColumns = (collectionName: string, columns: string[]) => {
    // Filter out system columns and show relevant ones
    const systemColumns = ["id", "_version", "_created_at", "_updated_at"];
    const filtered = columns.filter((col) => !systemColumns.includes(col));

    // Add system columns back at the end for debugging
    return [
      ...filtered,
      ...systemColumns.filter((col) => columns.includes(col)),
    ];
  };

  const activeCollectionMeta = collections.find(
    (c) => c.name === activeCollection
  );
  const displayColumns =
    activeCollectionMeta && activeCollection
      ? getDisplayColumns(activeCollection, activeCollectionMeta.columns)
      : [];

  if (loading && collections.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Loading collections...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Collection Selector */}
      <div className="border-b bg-gray-50 dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Collections
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || collections.length === 0}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors">
              <Download className="w-4 h-4" />
              {exporting ? "Exporting..." : "Export JSON"}
            </button>
            <button
              onClick={handleAddRow}
              disabled={!activeCollection || loading}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors">
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {collections.map((collection) => (
            <button
              key={collection.name}
              onClick={() => setActiveCollection(collection.name)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                activeCollection === collection.name
                  ? "bg-blue-600 dark:bg-blue-700 text-white"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
              }`}>
              {collection.name} ({collection.count})
            </button>
          ))}
        </div>
      </div>

      {/* Collection Data Table */}
      {activeCollection && (
        <div className="flex-1 overflow-auto">
          <CollectionTable
            data={collectionData || []}
            columns={displayColumns || []}
            onUpdate={handleUpdateRow}
            onDelete={handleDeleteRow}
            loading={loading}
          />
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast}
          type={
            toast.includes("❌") ||
            toast.includes("Failed") ||
            toast.includes("Error")
              ? "error"
              : toast.includes("✅") || toast.includes("successfully")
              ? "success"
              : "info"
          }
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

// Collection Table Component
interface CollectionTableProps {
  data: CollectionRow[];
  columns: string[];
  onUpdate: (rowId: string, field: string, value: any) => void;
  onDelete: (rowId: string) => void;
  loading: boolean;
}

const CollectionTable: React.FC<CollectionTableProps> = ({
  data,
  columns,
  onUpdate,
  onDelete,
  loading,
}) => {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowId?: string;
  } | null>(null);

  const DEFAULT_COLUMN_WIDTH = 120;
  const MIN_COLUMN_WIDTH = 60;

  // Column resizing functionality
  const handleMouseDown = (e: React.MouseEvent, columnIndex: number) => {
    e.preventDefault();
    setResizingColumn(columnIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[columnIndex] || DEFAULT_COLUMN_WIDTH);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (resizingColumn !== null) {
        const newWidth = Math.max(
          MIN_COLUMN_WIDTH,
          resizeStartWidth + (e.clientX - resizeStartX)
        );
        setColumnWidths((prev) => ({
          ...prev,
          [resizingColumn]: newWidth,
        }));
      }
    },
    [resizingColumn, resizeStartX, resizeStartWidth]
  );

  const handleMouseUp = useCallback(() => {
    setResizingColumn(null);
  }, []);

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

  // Context menu functionality
  const handleContextMenu = (e: React.MouseEvent, rowId?: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, rowId });
  };

  const handleAddRow = () => {
    // This will be handled by the parent component
    setContextMenu(null);
  };

  const handleDeleteRow = (rowId: string) => {
    onDelete(rowId);
    setContextMenu(null);
  };

  // Render cell value safely
  const renderCellValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "";
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    if (typeof value === "object") {
      return `{${Object.keys(value).length} properties}`;
    }
    return String(value);
  };

  // Safety checks
  if (!Array.isArray(data)) {
    console.warn("CollectionTable: data is not an array", data);
    return (
      <div className="p-4 text-center text-red-500">Invalid data format</div>
    );
  }

  if (!Array.isArray(columns)) {
    console.warn("CollectionTable: columns is not an array", columns);
    return (
      <div className="p-4 text-center text-red-500">Invalid columns format</div>
    );
  }

  const handleCellClick = (rowId: string, field: string, currentValue: any) => {
    setEditingCell({ rowId, field });
    setEditValue(String(currentValue || ""));
  };

  const handleCellSave = () => {
    if (!editingCell) return;

    onUpdate(editingCell.rowId, editingCell.field, editValue);
    setEditingCell(null);
    setEditValue("");
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCellSave();
    } else if (e.key === "Escape") {
      handleCellCancel();
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="collection-table h-full flex-1 min-h-0 flex flex-col overflow-hidden bg-gradient-to-br from-green-50/30 to-emerald-50/30 dark:from-gray-800 dark:to-gray-900">
      <div
        className="flex-1 min-h-0 overflow-y-auto pb-16 custom-scrollbar h-full"
        style={{
          height: "100%",
          scrollbarWidth: "thin",
          scrollbarColor: "#10b981 #d1fae5",
        }}>
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gradient-to-r from-green-100 to-emerald-100 dark:bg-gradient-to-r dark:from-green-900 dark:to-emerald-800 dark:border-b dark:border-gray-700 border-b border-green-300 shadow-sm">
              <th className="w-12 px-2 py-3 text-center text-xs font-semibold text-green-800 dark:text-green-200 bg-gradient-to-b from-green-100 to-green-200 dark:bg-gradient-to-b dark:from-green-900 dark:to-green-800 border-r border-green-300 dark:border-gray-700 select-none transition-all duration-200">
                <span title="Row number">#</span>
              </th>
              {columns.map((column, index) => (
                <th
                  key={column}
                  className="relative px-3 py-3 text-left text-xs font-semibold text-green-800 dark:text-green-200 bg-gradient-to-b from-green-100 to-green-200 dark:bg-gradient-to-b dark:from-green-900 dark:to-green-800 border-r border-green-300 dark:border-gray-700 select-none transition-all duration-200"
                  style={{
                    width: columnWidths[index] || DEFAULT_COLUMN_WIDTH,
                  }}>
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">{column}</span>
                  </div>

                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-green-500 dark:hover:bg-green-400 opacity-0 hover:opacity-100 transition-opacity duration-200"
                    onMouseDown={(e) => handleMouseDown(e, index)}
                    style={{ zIndex: 1000 }}
                  />
                </th>
              ))}
              <th className="w-16 px-2 py-3 text-center text-xs font-semibold text-green-800 dark:text-green-200 bg-gradient-to-b from-green-100 to-green-200 dark:bg-gradient-to-b dark:from-green-900 dark:to-green-800 border-r border-green-300 dark:border-gray-700 select-none transition-all duration-200">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              if (!row || !row.id) {
                console.warn(`Invalid row at index ${index}:`, row);
                return null;
              }
              return (
                <tr
                  key={row.id}
                  className="hover:bg-green-50/30 dark:hover:bg-green-800 transition-colors"
                  onContextMenu={(e) => handleContextMenu(e, row.id)}>
                  <td className="w-12 px-2 py-2 text-center text-xs font-medium text-gray-700 dark:text-green-100 bg-gray-50 dark:bg-green-900/10 border-r border-gray-300 dark:border-gray-700">
                    {index + 1}
                  </td>
                  {columns.map((column, colIndex) => (
                    <td
                      key={column}
                      className="relative px-3 py-2.5 text-sm border-r border-green-200/50 border-b border-green-200/50 dark:border-gray-700 cursor-cell transition-all duration-200 hover:bg-green-50/50 dark:hover:bg-green-800"
                      style={{
                        width: columnWidths[colIndex] || DEFAULT_COLUMN_WIDTH,
                      }}>
                      {editingCell?.rowId === row.id &&
                      editingCell?.field === column ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={handleKeyDown}
                          className="w-full h-full border-none outline-none bg-transparent text-sm"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() =>
                            handleCellClick(row.id, column, row[column])
                          }
                          className="cursor-pointer hover:bg-green-100/50 dark:hover:bg-green-700/50 p-1 rounded transition-colors">
                          <span className="truncate block w-full text-gray-900 dark:text-gray-100">
                            {renderCellValue(row[column])}
                          </span>
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="w-16 px-2 py-2 text-center border-r border-green-200/50 border-b border-green-200/50 dark:border-gray-700">
                    <button
                      onClick={() => onDelete(row.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1 transition-colors"
                      title="Delete row">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {data.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No data available
          </div>
        )}
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
            onClick={handleAddRow}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
            ➕ Add Row
          </button>
          {contextMenu.rowId && (
            <button
              onClick={() => handleDeleteRow(contextMenu.rowId!)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-2">
              🗑️ Delete Row
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CollectionDataViewer;
