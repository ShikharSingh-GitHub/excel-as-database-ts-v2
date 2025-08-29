import React, { useEffect } from "react";

export default function Toast({ 
  message, 
  type = "info", 
  onClose, 
  autoClose = true, 
  duration = 4000 
}: {
  message: string;
  type?: "info" | "success" | "error";
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}) {
  const bg =
    type === "success"
      ? "bg-green-500"
      : type === "error"
      ? "bg-red-500"
      : "bg-sky-500";

  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div
      className={`${bg} fixed top-4 right-4 p-4 rounded-lg text-white shadow-lg z-[10000] max-w-sm`}
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
