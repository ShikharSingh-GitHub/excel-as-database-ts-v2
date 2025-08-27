import React from "react";

export default function CrudModal({
  open,
  mode = "edit",
  title,
  headers = [],
  data = {},
  errors = {},
  conflict = null,
  onClose,
  onSubmit,
  onChange,
  onResolve,
}: any) {
  if (!open) return null;

  if (mode === "conflict" && conflict) {
    const pk =
      (conflict && (conflict.id ?? conflict[Object.keys(conflict)[0]])) || "id";
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
            Conflict detected
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            The row was changed by another process. Choose how to resolve.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-medium">Current (on disk)</h3>
              <div className="mt-2 border p-2 rounded bg-slate-50 dark:bg-slate-900 max-h-48 overflow-auto">
                {Object.entries(conflict).map(([k, v]) => (
                  <div key={k} className="text-sm">
                    <strong>{k}:</strong> {String(v)}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-medium">Your changes</h3>
              <div className="mt-2 border p-2 rounded bg-slate-50 dark:bg-slate-900 max-h-48 overflow-auto">
                {Object.entries(data || {}).map(([k, v]) => (
                  <div key={k} className="text-sm">
                    <strong>{k}:</strong> {String(v)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => onResolve && onResolve("reload")}
              className="px-4 py-2 bg-gray-200 rounded">
              Reload
            </button>
            <button
              onClick={() => onResolve && onResolve("overwrite")}
              className="px-4 py-2 bg-red-500 text-white rounded">
              Overwrite
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm max-h-[70vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
        </div>
        
        {/* Content */}
        <div className="px-4 py-3 max-h-[45vh] overflow-y-auto">
          <div className="space-y-3">
            {headers.map((header: string) => (
              <div key={header} className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {header}
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-colors text-sm"
                  value={data[header] || ""}
                  onChange={(e) => onChange && onChange(header, e.target.value)}
                  placeholder={`Enter ${header}...`}
                />
                {errors[header] && (
                  <p className="text-xs text-red-600 dark:text-red-400">{errors[header]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-end space-x-2">
          <button 
            onClick={onClose} 
            className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-md hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {mode === 'add' ? 'Add Row' : 'Update Row'}
          </button>
        </div>
      </div>
    </div>
  );
}
