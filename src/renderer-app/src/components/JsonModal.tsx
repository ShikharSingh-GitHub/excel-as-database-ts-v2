import { Download, FileText, Globe, X } from "lucide-react";
import React, { useState } from "react";
import Toast from "./Toast";

interface JsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (fileName: string) => void;
  currentFolder?: string;
}

const JsonModal: React.FC<JsonModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentFolder,
}) => {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT">("GET");
  const [payload, setPayload] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setToast("❌ Please enter a URL");
      return;
    }

    if (!fileName.trim()) {
      setToast("❌ Please enter a file name");
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      // Parse payload if provided
      let parsedPayload = null;
      if (payload.trim() && (method === "POST" || method === "PUT")) {
        try {
          parsedPayload = JSON.parse(payload);
        } catch (e) {
          setToast("❌ Invalid JSON payload");
          setLoading(false);
          return;
        }
      }

      // Fetch data from API
      const result = await (window as any).api.json.fetch(
        url,
        method,
        parsedPayload
      );

      console.log("API fetch result:", result);

      if (result.error) {
        setToast(`❌ Failed to fetch data: ${result.message}`);
        setLoading(false);
        return;
      }

      // Validate that we got valid data
      if (!result || typeof result.data === "undefined") {
        setToast("❌ No data received from API");
        setLoading(false);
        return;
      }

      console.log("Data to save:", result.data);
      console.log("Current folder:", currentFolder);

      // Save the data as JSON file
      const finalFileName = fileName.endsWith(".json")
        ? fileName
        : `${fileName}.json`;

      console.log("💾 Saving JSON file:", {
        currentFolder,
        finalFileName,
        dataSize: JSON.stringify(result.data).length,
      });

      const saveResult = currentFolder
        ? await (window as any).api.json.save(
            currentFolder,
            finalFileName,
            result.data
          )
        : await (window as any).api.json.save(finalFileName, result.data);

      console.log("💾 Save Result:", saveResult);

      if (saveResult.error) {
        setToast(`❌ Failed to save file: ${saveResult.message}`);
        setLoading(false);
        return;
      }

      setToast("✅ JSON file created successfully");
      onSuccess(saveResult.filePath);

      // Reset form
      setUrl("");
      setPayload("");
      setFileName("");
      setMethod("GET");

      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      setToast(`❌ Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUrl("");
      setPayload("");
      setFileName("");
      setMethod("GET");
      setToast(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add JSON File
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API URL
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/data"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              HTTP Method
            </label>
            <select
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as "GET" | "POST" | "PUT")
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={loading}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </div>

          {/* Payload Input (for POST/PUT) */}
          {(method === "POST" || method === "PUT") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Request Payload (JSON)
              </label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder='{"key": "value"}'
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                disabled={loading}
              />
            </div>
          )}

          {/* File Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File Name
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="my-data"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
                disabled={loading}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              .json extension will be added automatically
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim() || !fileName.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Fetching...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Create JSON File
                </>
              )}
            </button>
          </div>
        </form>

        {/* Toast Notifications */}
        {toast && (
          <div className="px-6 pb-4">
            <Toast
              message={toast}
              type={
                toast.includes("❌") ||
                toast.includes("Failed") ||
                toast.includes("Error")
                  ? "error"
                  : toast.includes("✅") || toast.includes("successfully")
                  ? "success"
                  : "info"
              }
              onClose={() => setToast(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonModal;
