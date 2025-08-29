import React from "react";
import { X, AlertTriangle, Save, RotateCcw } from "lucide-react";

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
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
        <div className="bg-white rounded-xl shadow-2xl border border-blue-200 w-full max-w-4xl max-h-[90vh] overflow-hidden m-4">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-600" size={24} />
              <h2 className="text-lg font-bold text-red-800">
                Conflict Detected
              </h2>
              <button
                onClick={onClose}
                className="ml-auto p-1 hover:bg-red-100 rounded-lg transition-colors">
                <X size={20} className="text-red-600" />
              </button>
            </div>
            <p className="text-sm text-red-700 mt-2">
              The row was changed by another process. Choose how to resolve.
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold text-blue-800 mb-3">Current (on disk)</h3>
                <div className="border border-blue-200 p-4 rounded-lg bg-blue-50/50 max-h-48 overflow-auto">
                  {Object.entries(conflict).map(([k, v]) => (
                    <div key={k} className="text-sm mb-2">
                      <strong className="text-blue-900">{k}:</strong> <span className="text-blue-700">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-blue-800 mb-3">Your changes</h3>
                <div className="border border-blue-200 p-4 rounded-lg bg-blue-50/50 max-h-48 overflow-auto">
                  {Object.entries(data || {}).map(([k, v]) => (
                    <div key={k} className="text-sm mb-2">
                      <strong className="text-blue-900">{k}:</strong> <span className="text-blue-700">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => onResolve && onResolve("reload")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 font-medium">
                <RotateCcw size={16} />
                Reload
              </button>
              <button
                onClick={() => onResolve && onResolve("overwrite")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium">
                <Save size={16} />
                Overwrite
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-blue-200 w-full max-w-md max-h-[70vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-blue-100 rounded-lg transition-colors">
              <X size={20} className="text-blue-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[40vh] overflow-y-auto">
          <div className="space-y-4">
            {headers.map((header: string) => (
              <div key={header} className="space-y-2">
                <label className="block text-sm font-medium text-blue-800">
                  {header}
                </label>
                <input
                  className="w-full px-3 py-2.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm bg-blue-50/30 focus:bg-white"
                  value={data[header] || ""}
                  onChange={(e) => onChange && onChange(header, e.target.value)}
                  placeholder={`Enter ${header}...`}
                />
                {errors[header] && (
                  <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    {errors[header]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-blue-200 bg-blue-50/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-all duration-200 font-medium">
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium">
            <Save size={16} />
            {mode === "edit" ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
