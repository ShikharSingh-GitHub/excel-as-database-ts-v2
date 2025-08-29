import React, { useEffect, useRef } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onInsertRow?: () => void;
  onDeleteRow?: () => void;
  onInsertColumn?: () => void;
  onDeleteColumn?: () => void;
  onSort?: (direction: "asc" | "desc" | "reset") => void;
  onFilter?: () => void;
  onHideColumn?: () => void;
  readOnly?: boolean;
  // when provided, this is a header-level menu
  header?: string | null;
}

export default function ContextMenu({
  x,
  y,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onInsertRow,
  onDeleteRow,
  onInsertColumn,
  onDeleteColumn,
  onSort,
  onFilter,
  readOnly = false,
  onHideColumn,
  header = null,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      label: "Cut",
      shortcut: "Ctrl+X",
      onClick: onCut,
      disabled: readOnly,
      separator: false,
    },
    {
      label: "Copy",
      shortcut: "Ctrl+C",
      onClick: onCopy,
      disabled: false,
      separator: false,
    },
    {
      label: "Paste",
      shortcut: "Ctrl+V",
      onClick: onPaste,
      disabled: readOnly,
      separator: true,
    },
    {
      label: "Insert Row Above",
      shortcut: "",
      onClick: onInsertRow,
      disabled: readOnly,
      separator: false,
    },
    {
      label: "Delete Row",
      shortcut: "",
      onClick: onDeleteRow,
      disabled: readOnly,
      separator: false,
    },
    {
      label: "Insert Column",
      shortcut: "",
      onClick: onInsertColumn,
      disabled: readOnly,
      separator: false,
    },
    {
      label: "Delete Column",
      shortcut: "",
      onClick: onDeleteColumn,
      disabled: readOnly,
      separator: true,
    },
    {
      label: "Sort Ascending",
      shortcut: "",
      onClick: () => onSort?.("asc"),
      disabled: false,
      separator: false,
    },
    {
      label: "Sort Descending",
      shortcut: "",
      onClick: () => onSort?.("desc"),
      disabled: false,
      separator: false,
    },
    {
      label: "Reset Sort",
      shortcut: "",
      onClick: () => onSort?.("reset" as any),
      disabled: false,
      separator: false,
    },
    {
      label: "Filter",
      shortcut: "",
      onClick: onFilter,
      disabled: false,
      separator: false,
    },
    // header specific options will be injected later
  ];

  // If header is present, prepend header-specific items
  const headerItems = header
    ? [
        {
          label: `Filter \u2014 ${header}`,
          shortcut: "",
          onClick: onFilter,
          disabled: false,
          separator: false,
        },
        {
          label: `Hide Column \u2014 ${header}`,
          shortcut: "",
          onClick: onHideColumn,
          disabled: false,
          separator: true,
        },
      ]
    : [];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg py-1 z-50 min-w-48 text-gray-900 dark:text-gray-100"
      style={{ left: x, top: y }}>
      {menuItems.map((item, index) => (
        <React.Fragment key={index}>
          <button
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`
              w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center justify-between
              ${
                item.disabled
                  ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  : "text-gray-700 dark:text-gray-100 cursor-pointer"
              }
            `}>
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-gray-400 ml-4">
                {item.shortcut}
              </span>
            )}
          </button>
          {item.separator && (
            <hr className="my-1 border-gray-200 dark:border-gray-700" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
