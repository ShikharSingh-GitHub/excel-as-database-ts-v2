const React = window.React;

function SheetTabs(props) {
  const { sheets = [], active, onSelect, onReload } = props || {};

  const tabs = (sheets || []).map((s) =>
    React.createElement(
      "button",
      {
        key: s.name,
        onClick: () => onSelect && onSelect(s.name),
        className:
          "px-3 py-2 rounded-md " +
          (active === s.name
            ? "underline text-violet-600"
            : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"),
      },
      s.name,
      React.createElement(
        "span",
        { className: "text-xs text-slate-400" },
        `(${s.rows})`
      )
    )
  );

  return React.createElement(
    "div",
    {
      className:
        "flex items-center gap-2 border-b pb-2 overflow-hidden bg-slate-50 dark:bg-slate-900",
    },
    React.createElement(
      "div",
      { className: "flex gap-2 overflow-x-auto" },
      ...tabs
    ),
    React.createElement(
      "div",
      { className: "ml-auto flex items-center gap-2" },
      React.createElement(
        "button",
        {
          onClick: onReload,
          className:
            "p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800",
          title: "Reload",
        },
        "\u21bb"
      )
    )
  );
}

if (typeof window !== "undefined") window.SheetTabs = SheetTabs;
