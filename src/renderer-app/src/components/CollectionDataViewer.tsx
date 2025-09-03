import { flexRender, getCoreRowModel, useTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Edit, Plus, Trash2, Download } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

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
      const hasCollections = await window.api.normalize.hasCollections(
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
          const meta = await window.api.collection.meta(collectionName);
          if (meta.count > 0) {
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
      }
    } catch (err) {
      setError(`Failed to load collections: ${err}`);
      console.error("Error loading collections:", err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeJsonFile = async () => {
    try {
      // Read the JSON file and normalize it
      const jsonData = await window.api.json.read(fileName, "default");
      if (jsonData.rawData) {
        await window.api.normalize.json(jsonData.rawData, fileName);
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

      const data = await window.api.collection.list({
        collection: collectionName,
      });

      setCollectionData(data);
    } catch (err) {
      setError(`Failed to load ${collectionName}: ${err}`);
      console.error(`Error loading collection ${collectionName}:`, err);
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

      const result = await window.api.collection.create({
        collection: activeCollection,
        row: newRow,
      });

      if (result.error) {
        setError(`Failed to add row: ${result.message}`);
        return;
      }

      // Reload collection data
      await loadCollectionData(activeCollection);
    } catch (err) {
      setError(`Failed to add row: ${err}`);
      console.error("Error adding row:", err);
    }
  };

  const handleUpdateRow = async (rowId: string, field: string, value: any) => {
    if (!activeCollection) return;

    try {
      const row = collectionData.find((r) => r.id === rowId);
      if (!row) return;

      const result = await window.api.collection.update({
        collection: activeCollection,
        id: rowId,
        expectedVersion: row._version,
        patch: { [field]: value },
      });

      if (result.error) {
        if (result.conflict) {
          setError("Conflict detected. Please refresh and try again.");
        } else {
          setError(`Failed to update row: ${result.message}`);
        }
        return;
      }

      // Update local data
      setCollectionData((prev) =>
        prev.map((r) => (r.id === rowId ? result.row : r))
      );
    } catch (err) {
      setError(`Failed to update row: ${err}`);
      console.error("Error updating row:", err);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!activeCollection) return;

    try {
      const row = collectionData.find((r) => r.id === rowId);
      if (!row) return;

      const result = await window.api.collection.delete({
        collection: activeCollection,
        id: rowId,
        expectedVersion: row._version,
      });

      if (result.error) {
        if (result.conflict) {
          setError("Conflict detected. Please refresh and try again.");
        } else {
          setError(`Failed to delete row: ${result.message}`);
        }
        return;
      }

      // Update local data
      setCollectionData((prev) => prev.filter((r) => r.id !== rowId));
    } catch (err) {
      setError(`Failed to delete row: ${err}`);
      console.error("Error deleting row:", err);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);

      // Generate export filename
      const baseName = fileName.split('/').pop()?.replace('.json', '') || 'export';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportFileName = `${baseName}_export_${timestamp}.json`;

      // Get the folder path from config
      const config = await window.api.config.get();
      const folderPath = config.folderPath || '/Users/shikhar/Developer/workbook';
      const exportPath = `${folderPath}/${exportFileName}`;

      // Export the JSON
      const result = await window.api.json.export(fileName, exportPath);

      if (result.error) {
        setError(`Export failed: ${result.message}`);
        return;
      }

      // Show success message
      setError(null);
      alert(`JSON exported successfully to:\n${result.path}`);
    } catch (err) {
      setError(`Export failed: ${err}`);
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
  const displayColumns = activeCollectionMeta
    ? getDisplayColumns(activeCollection, activeCollectionMeta.columns)
    : [];

  if (loading && collections.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading collections...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-red-600 hover:text-red-800">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Collection Selector */}
      <div className="border-b bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Collections</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || collections.length === 0}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              <Download className="w-4 h-4" />
              {exporting ? "Exporting..." : "Export JSON"}
            </button>
            <button
              onClick={handleAddRow}
              disabled={!activeCollection || loading}
              className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
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
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100 border"
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
            data={collectionData}
            columns={displayColumns}
            onUpdate={handleUpdateRow}
            onDelete={handleDeleteRow}
            loading={loading}
          />
        </div>
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {columns.map((column) => (
              <th key={column} className="border p-2 text-left font-medium">
                {column}
              </th>
            ))}
            <th className="border p-2 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column} className="border p-2">
                  {editingCell?.rowId === row.id &&
                  editingCell?.field === column ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={handleKeyDown}
                      className="w-full px-2 py-1 border rounded"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() =>
                        handleCellClick(row.id, column, row[column])
                      }
                      className="cursor-pointer hover:bg-blue-50 p-1 rounded">
                      {row[column] !== null && row[column] !== undefined
                        ? String(row[column])
                        : ""}
                    </div>
                  )}
                </td>
              ))}
              <td className="border p-2">
                <button
                  onClick={() => onDelete(row.id)}
                  className="text-red-600 hover:text-red-800 p-1"
                  title="Delete row">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="p-8 text-center text-gray-500">No data available</div>
      )}
    </div>
  );
};

export default CollectionDataViewer;
