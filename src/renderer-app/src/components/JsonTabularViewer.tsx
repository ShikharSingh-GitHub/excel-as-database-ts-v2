import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Plus, Settings } from 'lucide-react';
import { JsonViewerProps, JsonTab, JsonViewerState, CrudOperation } from '../types/jsonViewer';
import { jsonParserService } from '../services/jsonParser';
import JsonTable from './JsonTable';
import Toast from './Toast';

const JsonTabularViewer: React.FC<JsonViewerProps> = ({
  fileName,
  data,
  onDataChange,
  onSave,
  readOnly = false,
  maxDepth = 6,
  autoDetectPrimaryKeys = true,
}) => {
  const [state, setState] = useState<JsonViewerState>({
    tabs: [],
    activeTab: null,
    expandedRows: new Set(),
    selectedRows: new Set(),
    editingCell: null,
    loading: false,
    error: null,
  });

  const [toast, setToast] = useState<string | null>(null);

  // Initialize JSON parser configuration
  useEffect(() => {
    jsonParserService.updateConfig({
      maxDepth,
      autoDetectPrimaryKeys,
    });
  }, [maxDepth, autoDetectPrimaryKeys]);

  // Parse JSON data when it changes
  useEffect(() => {
    if (data) {
      parseJsonData();
    }
  }, [data, fileName]);

  const parseJsonData = useCallback(() => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const tabs = jsonParserService.parseJsonToTabs(data, fileName);
      
      setState(prev => ({
        ...prev,
        tabs,
        activeTab: tabs.length > 0 ? tabs[0].id : null,
        loading: false,
      }));

      if (tabs.length === 0) {
        setToast('ℹ️ No tabular data found in this JSON file');
      } else {
        setToast(`✅ Loaded ${tabs.length} data tables`);
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Failed to parse JSON: ${error}`,
      }));
      setToast(`❌ Failed to parse JSON: ${error}`);
    }
  }, [data, fileName]);

  const handleTabChange = useCallback((tabId: string) => {
    setState(prev => ({
      ...prev,
      activeTab: tabId,
    }));
  }, []);

  const handleRowExpand = useCallback((rowId: string) => {
    setState(prev => ({
      ...prev,
      expandedRows: new Set([...prev.expandedRows, rowId]),
    }));
  }, []);

  const handleRowCollapse = useCallback((rowId: string) => {
    setState(prev => {
      const newExpandedRows = new Set(prev.expandedRows);
      newExpandedRows.delete(rowId);
      return {
        ...prev,
        expandedRows: newExpandedRows,
      };
    });
  }, []);

  const handleRowSelect = useCallback((rowId: string, selected: boolean) => {
    setState(prev => {
      const newSelectedRows = new Set(prev.selectedRows);
      if (selected) {
        newSelectedRows.add(rowId);
      } else {
        newSelectedRows.delete(rowId);
      }
      return {
        ...prev,
        selectedRows: newSelectedRows,
      };
    });
  }, []);

  const handleCellEdit = useCallback((rowId: string, columnId: string) => {
    setState(prev => ({
      ...prev,
      editingCell: { rowId, columnId },
    }));
  }, []);

  const handleCellEditComplete = useCallback((rowId: string, columnId: string, newValue: any) => {
    const activeTab = state.tabs.find(tab => tab.id === state.activeTab);
    if (!activeTab) return;

    // Update the data
    const updatedData = { ...data };
    const pathParts = activeTab.schema.path.split('.');
    let current = updatedData;
    
    // Navigate to the array
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }
    
    // Find and update the specific row
    const arrayPath = pathParts[pathParts.length - 1];
    if (Array.isArray(current[arrayPath])) {
      const rowIndex = current[arrayPath].findIndex((item: any) => {
        const pk = activeTab.schema.primaryKey;
        return pk ? item[pk] === rowId : false;
      });
      
      if (rowIndex !== -1) {
        current[arrayPath][rowIndex][columnId] = newValue;
        
        // Trigger data change callback
        if (onDataChange) {
          onDataChange(updatedData);
        }
        
        setToast('✅ Cell updated successfully');
      }
    }

    setState(prev => ({
      ...prev,
      editingCell: null,
    }));
  }, [state.tabs, state.activeTab, data, onDataChange]);

  const handleRowAdd = useCallback(() => {
    const activeTab = state.tabs.find(tab => tab.id === state.activeTab);
    if (!activeTab) return;

    // Create new row with default values
    const newRow: any = {};
    activeTab.schema.columns.forEach(column => {
      if (column.type === 'string') newRow[column.key] = '';
      else if (column.type === 'number') newRow[column.key] = 0;
      else if (column.type === 'boolean') newRow[column.key] = false;
      else newRow[column.key] = null;
    });

    // Add to data
    const updatedData = { ...data };
    const pathParts = activeTab.schema.path.split('.');
    let current = updatedData;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }
    
    const arrayPath = pathParts[pathParts.length - 1];
    if (Array.isArray(current[arrayPath])) {
      current[arrayPath].push(newRow);
      
      if (onDataChange) {
        onDataChange(updatedData);
      }
      
      setToast('✅ Row added successfully');
      parseJsonData(); // Refresh the view
    }
  }, [state.tabs, state.activeTab, data, onDataChange, parseJsonData]);

  const handleRowDelete = useCallback((rowId: string) => {
    const activeTab = state.tabs.find(tab => tab.id === state.activeTab);
    if (!activeTab) return;

    const updatedData = { ...data };
    const pathParts = activeTab.schema.path.split('.');
    let current = updatedData;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }
    
    const arrayPath = pathParts[pathParts.length - 1];
    if (Array.isArray(current[arrayPath])) {
      const pk = activeTab.schema.primaryKey;
      const rowIndex = current[arrayPath].findIndex((item: any) => 
        pk ? item[pk] === rowId : false
      );
      
      if (rowIndex !== -1) {
        current[arrayPath].splice(rowIndex, 1);
        
        if (onDataChange) {
          onDataChange(updatedData);
        }
        
        setToast('✅ Row deleted successfully');
        parseJsonData(); // Refresh the view
      }
    }
  }, [state.tabs, state.activeTab, data, onDataChange, parseJsonData]);

  const handleExport = useCallback(async () => {
    try {
      if (onSave) {
        await onSave(data);
        setToast('✅ JSON exported successfully');
      } else {
        setToast('ℹ️ No save handler configured');
      }
    } catch (error) {
      setToast(`❌ Export failed: ${error}`);
    }
  }, [data, onSave]);

  const activeTab = state.tabs.find(tab => tab.id === state.activeTab);

  if (state.loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Loading JSON data...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <p className="text-red-800 dark:text-red-200">{state.error}</p>
          <button
            onClick={() => setState(prev => ({ ...prev, error: null }))}
            className="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-gray-50 dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            JSON Data Viewer
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors">
              <Download className="w-4 h-4" />
              Export JSON
            </button>
            {!readOnly && (
              <button
                onClick={handleRowAdd}
                disabled={!activeTab}
                className="flex items-center gap-2 px-3 py-1 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors">
                <Plus className="w-4 h-4" />
                Add Row
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {state.tabs.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {state.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  tab.id === state.activeTab
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
                }`}>
                {tab.name} ({tab.schema.data.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table Content */}
      {activeTab ? (
        <div className="flex-1 overflow-auto">
          <JsonTable
            schema={activeTab.schema}
            expandedRows={state.expandedRows}
            selectedRows={state.selectedRows}
            editingCell={state.editingCell}
            onRowExpand={handleRowExpand}
            onRowCollapse={handleRowCollapse}
            onRowSelect={handleRowSelect}
            onCellEdit={handleCellEdit}
            onCellEditComplete={handleCellEditComplete}
            onRowDelete={handleRowDelete}
            readOnly={readOnly}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">No data to display</p>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast}
          type={
            toast.includes("❌") || toast.includes("Failed") || toast.includes("Error")
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

export default JsonTabularViewer;
