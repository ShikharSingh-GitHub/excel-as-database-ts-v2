const React = window.React;

function CrudModal(props) {
  const {
    open,
    title,
    headers = [],
    data = {},
    errors = {},
    onClose,
    onSubmit,
    onChange,
  } = props || {};

  if (!open) return null;

  const validate = () => {
    const newErrors = {};
    (headers || []).forEach((header) => {
      if (!data[header] || String(data[header]).trim() === "") {
        newErrors[header] = `${header} is required`;
      }
    });
    return newErrors;
  };

  const handleSubmit = () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      console.log("Validation errors", validationErrors);
      // The original component used state for errors; here we just log.
      return;
    }
    onSubmit && onSubmit();
  };

  const headerInputs = (headers || []).map((header) =>
    React.createElement(
      "div",
      { key: header, className: "mb-4" },
      React.createElement(
        "label",
        {
          htmlFor: header,
          className:
            "block text-sm font-medium text-gray-700 dark:text-gray-300",
        },
        header
      ),
      React.createElement("input", {
        id: header,
        type: "text",
        value: data[header] || "",
        onChange: (e) => onChange && onChange(header, e.target.value),
        className:
          "mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100",
      }),
      errors[header]
        ? React.createElement(
            "p",
            { className: "mt-1 text-sm text-red-600 dark:text-red-400" },
            errors[header]
          )
        : null
    )
  );

  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 flex items-center justify-center bg-black bg-opacity-50",
      role: "dialog",
      "aria-labelledby": "modal-title",
      "aria-modal": "true",
    },
    React.createElement(
      "div",
      { className: "bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-96" },
      React.createElement(
        "h2",
        {
          id: "modal-title",
          className: "text-lg font-bold mb-4 text-gray-900 dark:text-gray-100",
        },
        title
      ),
      ...headerInputs,
      React.createElement(
        "div",
        { className: "flex justify-end space-x-4" },
        React.createElement(
          "button",
          {
            onClick: onClose,
            className:
              "px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600",
            "aria-label": "Close modal",
          },
          "Close"
        ),
        React.createElement(
          "button",
          {
            onClick: handleSubmit,
            className:
              "px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600",
            "aria-label": "Submit form",
          },
          "Submit"
        )
      )
    )
  );
}

if (typeof window !== "undefined") window.CrudModal = CrudModal;
