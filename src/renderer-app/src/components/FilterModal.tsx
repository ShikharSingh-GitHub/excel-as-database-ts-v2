import React, { useEffect, useState } from "react";

interface FilterModalProps {
  open: boolean;
  headerOptions: string[];
  initialHeader?: string | null;
  initialValue?: string;
  onClose: () => void;
  onApply: (header: string | null, value: string) => void;
}

export default function FilterModal({
  open,
  headerOptions,
  initialHeader = null,
  initialValue = "",
  onClose,
  onApply,
}: FilterModalProps) {
  const [header, setHeader] = useState<string | null>(initialHeader || null);
  const [value, setValue] = useState<string>(initialValue || "");

  useEffect(() => {
    setHeader(initialHeader || null);
    setValue(initialValue || "");
  }, [initialHeader, initialValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-lg p-4 w-96">
        <h3 className="text-lg font-semibold mb-2">Filter</h3>
        <div className="mb-2">
          <label className="block text-sm text-gray-700 mb-1">Column</label>
          <select
            value={header || ""}
            onChange={(e) => setHeader(e.target.value || null)}
            className="w-full border px-2 py-1 rounded">
            <option value="">All columns</option>
            {headerOptions.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm text-gray-700 mb-1">Value</label>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full border px-2 py-1 rounded"
            placeholder="Contains..."
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">
            Cancel
          </button>
          <button
            onClick={() => onApply(header, value)}
            className="px-3 py-1 rounded bg-blue-600 text-white">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
