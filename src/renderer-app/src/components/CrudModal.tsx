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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-[820px] max-w-full">
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
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-96">
        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {headers.map((header: string) => (
          <div key={header} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {header}
            </label>
            <input
              className="mt-1 block w-full border px-2 py-1"
              value={data[header] || ""}
              onChange={(e) => onChange && onChange(header, e.target.value)}
            />
            {errors[header] && (
              <p className="mt-1 text-sm text-red-600">{errors[header]}</p>
            )}
          </div>
        ))}
        <div className="flex justify-end space-x-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">
            Close
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded">
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
