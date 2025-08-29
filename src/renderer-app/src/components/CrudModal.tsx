import { AlertTriangle, RotateCcw, Save, X } from "lucide-react";
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
  formulaColumns = [],
}: any) {
  if (!open) return null;

  if (mode === "conflict" && conflict) {
    const pk =
      (conflict && (conflict.id ?? conflict[Object.keys(conflict)[0]])) || "id";
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-blue-200 dark:border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden m-4">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900 dark:to-orange-900 border-b border-red-200 dark:border-red-800 px-6 py-4">
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
          <div className="p-6 text-gray-900 dark:text-gray-100">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold text-blue-800 mb-3">
                  Current (on disk)
                </h3>
                <div className="border border-blue-200 dark:border-gray-700 p-4 rounded-lg bg-blue-50/50 dark:bg-transparent max-h-48 overflow-auto">
                  {Object.entries(conflict).map(([k, v]) => (
                    <div key={k} className="text-sm mb-2">
                      <strong className="text-blue-900">{k}:</strong>{" "}
                      <span className="text-blue-700">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-blue-800 mb-3">
                  Your changes
                </h3>
                <div className="border border-blue-200 dark:border-gray-700 p-4 rounded-lg bg-blue-50/50 dark:bg-transparent max-h-48 overflow-auto">
                  {Object.entries(data || {}).map(([k, v]) => (
                    <div key={k} className="text-sm mb-2">
                      <strong className="text-blue-900">{k}:</strong>{" "}
                      <span className="text-blue-700">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => onResolve && onResolve("reload")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 font-medium">
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
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-blue-200 dark:border-gray-700 w-full max-w-md max-h-[70vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-blue-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-blue-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-blue-100 rounded-lg transition-colors">
              <X size={20} className="text-blue-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[40vh] overflow-y-auto text-gray-900 dark:text-gray-100">
          <div className="space-y-4">
            {headers.map((header: string) => {
              const isFormula =
                Array.isArray(formulaColumns) &&
                formulaColumns.includes(header);
              return (
                <div key={header} className="space-y-2">
                  <label className="block text-sm font-medium text-blue-800 dark:text-gray-200">
                    {header}
                  </label>
                  <div className="relative">
                    <input
                      readOnly={isFormula}
                      className={
                        "w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm " +
                        (isFormula
                          ? "bg-yellow-50/40 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700"
                          : "bg-blue-50/30 dark:bg-gray-800 dark:text-gray-100")
                      }
                      value={data[header] ?? ""}
                      onChange={(e) => {
                        if (!isFormula)
                          onChange && onChange(header, e.target.value);
                      }}
                      placeholder={
                        isFormula
                          ? `Formula column — read-only`
                          : `Enter ${header}...`
                      }
                    />
                    {isFormula && (
                      <span className="absolute right-2 top-2 text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                        formula
                      </span>
                    )}
                  </div>
                  {errors[header] && (
                    <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded dark:bg-red-900">
                      {errors[header]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-blue-200 dark:border-gray-700 bg-blue-50/30 dark:bg-transparent flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-blue-700 dark:text-gray-100 bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-200 font-medium">
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
