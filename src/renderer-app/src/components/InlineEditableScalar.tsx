import React, { useEffect, useState } from "react";

export default function InlineEditableScalar({
  value,
  path,
  editable,
  onCommit,
  className,
}: {
  value: any;
  path: string;
  editable: boolean;
  onCommit?: (path: string, next: any) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);

  if (!editable) {
    return (
      <span
        className={
          className ?? "text-gray-700 dark:text-gray-300 text-sm font-mono"
        }>
        {value == null || value === "" ? "—" : String(value)}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className={className ?? "text-sm text-blue-600"}>
        {value == null || value === "" ? "—" : String(value)}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit?.(path, draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setEditing(false);
          if (draft !== value) onCommit?.(path, draft);
        }
        if (e.key === "Escape") setEditing(false);
      }}
      className="border rounded px-2 py-1 text-sm"
    />
  );
}
