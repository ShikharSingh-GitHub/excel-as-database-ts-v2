import React from "react";

export default function Toast({ message, type = "info", onClose }: any) {
  const bg =
    type === "success"
      ? "bg-green-500"
      : type === "error"
      ? "bg-red-500"
      : "bg-sky-500";
  return (
    <div
      className={`${bg} fixed bottom-4 right-4 p-4 rounded text-white`}
      role="alert">
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4">
          ✕
        </button>
      </div>
    </div>
  );
}
