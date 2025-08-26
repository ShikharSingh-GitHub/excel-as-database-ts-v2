import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Toast({ message, type = "info", onClose }) {
    const bg = type === "success"
        ? "bg-green-500"
        : type === "error"
            ? "bg-red-500"
            : "bg-sky-500";
    return (_jsx("div", { className: `${bg} fixed bottom-4 right-4 p-4 rounded text-white`, role: "alert", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { children: message }), _jsx("button", { onClick: onClose, className: "ml-4", children: "\u2715" })] }) }));
}
//# sourceMappingURL=Toast.js.map