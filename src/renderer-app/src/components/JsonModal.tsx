import { AlertCircle, Download, X } from "lucide-react";
import React, { useState } from "react";

interface JsonModalProps {
  open: boolean;
  onClose: () => void;
  onAddJson: (
    url: string,
    name: string,
    method?: string,
    payload?: any,
    headers?: any
  ) => Promise<void>;
}

export default function JsonModal({
  open,
  onClose,
  onAddJson,
}: JsonModalProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState("GET");
  const [payload, setPayload] = useState("");
  const [headers, setHeaders] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!url.trim()) {
      setError("Please enter a valid API URL");
      return;
    }

    // Basic URL validation
    try {
      new URL(url.trim());
    } catch {
      setError("Please enter a valid URL (e.g., https://api.example.com/data)");
      return;
    }

    // Validate payload for POST requests
    let parsedPayload = null;
    if (method === "POST" && payload.trim()) {
      try {
        parsedPayload = JSON.parse(payload.trim());
      } catch {
        setError("Please enter valid JSON for the payload");
        return;
      }
    }

    // Validate headers
    let parsedHeaders = {};
    if (headers.trim()) {
      try {
        parsedHeaders = JSON.parse(headers.trim());
      } catch {
        setError("Please enter valid JSON for the headers");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      await onAddJson(
        url.trim(),
        name.trim() || "API Data",
        method,
        parsedPayload,
        parsedHeaders
      );
      onClose();
      setUrl("");
      setName("");
      setMethod("GET");
      setPayload("");
    } catch (err: any) {
      setError(err.message || "Failed to fetch JSON data");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setUrl("");
      setName("");
      setMethod("GET");
      setPayload("");
      setHeaders("");
      setError("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleSubmit();
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-[90vw] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Add JSON File from API
            </h3>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              API URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://infoorigin-upgrade.infoapps.io/api-core/v1/unauthorizedActionflow/adf44951-13b4-4cd3-a7aa-c8e50d79f9e1"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter the API endpoint URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              HTTP Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
              <option value="GET">GET - Fetch data</option>
              <option value="POST">POST - Send data</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Custom Headers (JSON) - Optional
            </label>
            <textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder='{"Authorization": "Bearer your-token", "X-API-Key": "your-key"}'
              disabled={loading}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Add custom headers like Authorization tokens for authenticated
              APIs
            </p>
          </div>

          {method === "POST" && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Request Payload (JSON) *
              </label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder='{"data": {"TYPE": "TEST_CASE", "APP_LOGGED_IN_FUNTIONAL_AREA_ID": "..."}}'
                disabled={loading}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter the JSON payload to send with the POST request
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Users Data"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              A friendly name for the data (defaults to "API Data")
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Add JSON File
              </>
            )}
          </button>
        </div>

        {/* Help text */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Usage:</strong>
            <br />• <strong>GET:</strong> Fetch data from APIs that return JSON
            <br />• <strong>POST:</strong> Send a payload and receive a response
            <br />
            <br />
            <strong>Examples:</strong>
            <br />• GET:{" "}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              https://jsonplaceholder.typicode.com/users
            </code>
            <br />• Your API:{" "}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              https://infoorigin-upgrade.infoapps.io/api-core/v1/unauthorizedActionflow/adf44951-13b4-4cd3-a7aa-c8e50d79f9e1
            </code>
            <br />
            <br />
            <strong>Note:</strong> Make sure to use the correct HTTP method
            (GET/POST) and add any required authentication headers.
          </p>
        </div>
      </div>
    </div>
  );
}
