const React = window.React;

function Toast(props) {
  const { message, type = "info", onClose } = props || {};
  const bgClass =
    type === "success"
      ? "bg-green-500 dark:bg-green-600"
      : "bg-red-500 dark:bg-red-600";

  return React.createElement(
    "div",
    {
      className: `fixed bottom-4 right-4 p-4 rounded shadow-lg text-white ${bgClass}`,
      role: "alert",
      "aria-live": "assertive",
      "aria-atomic": "true",
    },
    React.createElement(
      "div",
      { className: "flex items-center justify-between" },
      React.createElement(
        "span",
        { className: "text-sm font-medium" },
        message
      ),
      React.createElement(
        "button",
        {
          className: "ml-4 text-white hover:text-gray-200",
          onClick: onClose,
          "aria-label": "Close notification",
        },
        "\u2715"
      )
    )
  );
}

if (typeof window !== "undefined") window.Toast = Toast;
