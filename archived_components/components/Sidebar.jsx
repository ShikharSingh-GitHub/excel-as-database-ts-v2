const React = window.React;

function Sidebar(props) {
  const {
    files = [],
    activePath,
    onOpen,
    onRefresh,
    autoRefresh,
    onToggleAutoRefresh,
  } = props || {};

  const content =
    files && files.length > 0
      ? files.map((f) =>
          React.createElement(
            "div",
            {
              key: f.path,
              className:
                "p-2 rounded cursor-pointer " +
                (activePath === f.path
                  ? "bg-violet-100 dark:bg-violet-900"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"),
              onClick: () => onOpen && onOpen(f),
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "span",
                { className: "font-medium text-slate-700 dark:text-slate-200" },
                f.name
              ),
              React.createElement(
                "span",
                { className: "ml-auto text-xs text-slate-400" },
                Math.round((f.size || 0) / 1024) +
                  " KB \u2022 " +
                  new Date(f.mtimeMs || 0).toLocaleString()
              )
            )
          )
        )
      : React.createElement(
          "div",
          { className: "p-4 text-sm text-slate-500" },
          "No files"
        );

  return React.createElement(
    "aside",
    {
      className:
        "w-72 p-4 border-r h-full flex flex-col gap-4 bg-slate-50 dark:bg-slate-900",
    },
    React.createElement(
      "div",
      { className: "flex items-center justify-between" },
      React.createElement(
        "h3",
        {
          className: "text-sm font-semibold text-slate-700 dark:text-slate-300",
        },
        "Workbooks"
      ),
      React.createElement(
        "button",
        {
          className:
            "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800",
          onClick: onRefresh,
          title: "Refresh",
        },
        React.createElement(
          "span",
          { className: "w-4 h-4 text-slate-600 dark:text-slate-400" },
          "\u21bb"
        )
      )
    ),
    React.createElement(
      "div",
      { className: "flex items-center gap-2 text-xs text-slate-500" },
      React.createElement(
        "label",
        { className: "flex items-center gap-2" },
        React.createElement("input", {
          type: "checkbox",
          checked: !!autoRefresh,
          onChange: onToggleAutoRefresh,
        }),
        " Auto Refresh"
      )
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-y-auto space-y-2" },
      content
    )
  );
}

// Attach Sidebar to the global window object
if (typeof window !== "undefined") window.Sidebar = Sidebar;
