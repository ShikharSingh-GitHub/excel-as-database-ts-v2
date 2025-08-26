const React = window.React;

function DataGrid(props) {
  const {
    headers = [],
    rows = [],
    onEdit,
    onDelete,
    onSort,
    sortKey,
    sortDirection,
  } = props || {};

  const headerCells = (headers || []).map((header) =>
    React.createElement(
      "th",
      {
        key: header,
        className:
          "px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer",
        onClick: () => onSort && onSort(header),
      },
      header,
      sortKey === header
        ? React.createElement(
            "span",
            { className: "ml-1" },
            sortDirection === "asc" ? "\u25b2" : "\u25bc"
          )
        : null
    )
  );

  const body =
    rows && rows.length > 0
      ? rows.map((row, idx) =>
          React.createElement(
            "tr",
            {
              key: idx,
              className: "hover:bg-slate-50 dark:hover:bg-slate-800",
            },
            ...(headers || []).map((header) =>
              React.createElement(
                "td",
                {
                  key: header,
                  className: "px-4 py-2 text-slate-700 dark:text-slate-200",
                },
                String(row[header] ?? "")
              )
            ),
            React.createElement(
              "td",
              { className: "px-4 py-2" },
              React.createElement(
                "button",
                {
                  className: "mr-2 px-2 py-1 bg-blue-500 text-white rounded",
                  onClick: () => onEdit && onEdit(row),
                },
                "Edit"
              ),
              React.createElement(
                "button",
                {
                  className: "px-2 py-1 bg-red-500 text-white rounded",
                  onClick: () => onDelete && onDelete(row),
                },
                "Delete"
              )
            )
          )
        )
      : React.createElement(
          "tr",
          null,
          React.createElement(
            "td",
            {
              colSpan: (headers || []).length + 1,
              className: "px-4 py-2 text-center text-sm text-slate-500",
            },
            "No data"
          )
        );

  return React.createElement(
    "div",
    { className: "overflow-x-auto" },
    React.createElement(
      "table",
      {
        className:
          "min-w-full border-collapse border border-slate-200 dark:border-slate-700",
      },
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          { className: "bg-slate-100 dark:bg-slate-800" },
          ...headerCells,
          React.createElement(
            "th",
            {
              className:
                "px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300",
            },
            "Actions"
          )
        )
      ),
      React.createElement("tbody", null, body)
    )
  );
}

// Attach DataGrid to the global window object
if (typeof window !== "undefined") window.DataGrid = DataGrid;
