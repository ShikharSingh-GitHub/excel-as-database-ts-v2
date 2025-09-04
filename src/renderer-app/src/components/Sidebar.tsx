import {
  File,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
} from "lucide-react";
import React from "react";
import Tooltip from "./Tooltip";

export type Workbook = {
  name: string;
  path?: string;
  size?: number;
  mtimeMs?: number;
  macro?: boolean;
};

export default function Sidebar({
  files = [],
  recentWorkbooks = [],
  activePath,
  onOpen,
  onRefresh,
  onPickFolder,
  onAddJson,
}: {
  files?: Workbook[];
  recentWorkbooks?: string[];
  activePath?: string | null;
  onOpen?: (f: Workbook) => void;
  onRefresh?: () => void;
  onPickFolder?: () => void;
  onAddJson?: () => void;
}) {
  // Helper function to determine file type
  const getFileType = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".json")) return "json";
    if (lower.endsWith(".xlsm")) return "xlsm";
    if (lower.endsWith(".xlsx")) return "xlsx";
    return "unknown";
  };

  // Filter recent workbooks to only show those that still exist
  const validRecentWorkbooks = recentWorkbooks
    .filter((path) => files.some((f) => f.path === path))
    .map((path) => files.find((f) => f.path === path))
    .filter(Boolean) as Workbook[];

  return (
    <aside className="w-64 border-r border-blue-200 dark:border-gray-700 bg-gradient-to-b from-blue-50/80 to-indigo-50/80 dark:from-gray-900 dark:to-gray-800 backdrop-blur-md flex flex-col min-h-0">
      <div className="p-3 border-b border-blue-200/50">
        <div className="flex items-center justify-center gap-2">
          <Tooltip content="Add JSON file from API">
            <button
              onClick={onAddJson}
              aria-label="Add JSON File"
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 dark:bg-green-700 text-white text-sm font-medium rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
              disabled={!onAddJson}>
              <Plus size={14} />
              Add JSON
            </button>
          </Tooltip>
          <Tooltip content="Select a folder containing Excel files">
            <button
              onClick={onPickFolder}
              aria-label="Choose Folder"
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              disabled={!onPickFolder}>
              <FolderOpen size={14} />
              Choose Folder
            </button>
          </Tooltip>
          <Tooltip content="Refresh file list">
            <button
              onClick={onRefresh}
              aria-label="Refresh"
              className="p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 text-blue-700 dark:text-gray-300 hover:text-blue-800 dark:hover:text-gray-200 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
              <RefreshCw size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Recent Workbooks Section */}
      {validRecentWorkbooks.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-sm font-medium text-blue-800 dark:text-gray-200 mb-3">
            Recent Files
          </h3>
          <div className="space-y-2">
            {validRecentWorkbooks.slice(0, 3).map((f) => {
              const fileType = getFileType(f.name);
              const isJson = fileType === "json";
              const isXlsm = fileType === "xlsm";

              return (
                <Tooltip
                  key={f.path ?? f.name}
                  content={`Open ${f.name} (${Math.round(
                    (f.size || 0) / 1024
                  )} KB)`}>
                  <button
                    onClick={() => onOpen && onOpen(f)}
                    className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                      activePath === f.path
                        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-800 shadow-sm"
                        : "border-blue-200/50 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-gray-500"
                    }`}>
                    {isJson ? (
                      <FileText
                        size={14}
                        className="text-green-600 dark:text-green-400 flex-shrink-0"
                      />
                    ) : (
                      <FileSpreadsheet
                        size={14}
                        className="text-blue-600 dark:text-blue-400 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 truncate">
                      <div className="font-medium text-blue-900 dark:text-gray-100 truncate text-sm">
                        {f.name}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-gray-300">
                        {f.mtimeMs
                          ? new Date(f.mtimeMs).toLocaleDateString()
                          : ""}
                      </div>
                    </div>
                    {isJson && (
                      <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-800 dark:text-green-300">
                        JSON
                      </span>
                    )}
                    {isXlsm && (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
                        xlsm
                      </span>
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* All Files Section */}
      <div className="px-4 py-3 border-b border-blue-200/50">
        <h3 className="text-sm font-medium text-blue-800">
          All Files ({files.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
        {files.length === 0 ? (
          <div className="p-6 text-center">
            <File size={32} className="mx-auto text-blue-400 mb-2" />
            <p className="text-sm text-blue-600 dark:text-blue-400">
              No files found
            </p>
            <p className="text-xs text-blue-500 dark:text-blue-500 mt-1">
              Choose a folder to get started
            </p>
          </div>
        ) : (
          files.map((f) => {
            const fileType = getFileType(f.name);
            const isJson = fileType === "json";
            const isXlsm = fileType === "xlsm";

            return (
              <Tooltip
                key={f.path ?? f.name}
                content={`Open ${f.name} - Last modified: ${
                  f.mtimeMs ? new Date(f.mtimeMs).toLocaleString() : "Unknown"
                }`}>
                <button
                  onClick={() => onOpen && onOpen(f)}
                  className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    activePath === f.path
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-800 shadow-sm"
                      : "border-blue-200/50 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-gray-500"
                  }`}>
                  {isJson ? (
                    <FileText
                      size={14}
                      className="text-green-600 dark:text-green-400 flex-shrink-0"
                    />
                  ) : (
                    <FileSpreadsheet
                      size={14}
                      className="text-blue-600 dark:text-blue-400 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 truncate">
                    <div className="font-medium text-blue-900 dark:text-gray-100 truncate text-sm">
                      {f.name}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-gray-300">
                      {Math.round((f.size || 0) / 1024)} KB •{" "}
                      {f.mtimeMs
                        ? new Date(f.mtimeMs).toLocaleDateString()
                        : ""}
                    </div>
                  </div>
                  {isJson && (
                    <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-800 dark:text-green-300">
                      JSON
                    </span>
                  )}
                  {isXlsm && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white">
                      xlsm
                    </span>
                  )}
                </button>
              </Tooltip>
            );
          })
        )}
      </div>
    </aside>
  );
}
