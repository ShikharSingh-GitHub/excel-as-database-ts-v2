import React from "react";
import { FolderOpen, RefreshCw, File, FileSpreadsheet } from "lucide-react";
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
}: {
  files?: Workbook[];
  recentWorkbooks?: string[];
  activePath?: string | null;
  onOpen?: (f: Workbook) => void;
  onRefresh?: () => void;
  onPickFolder?: () => void;
}) {
  // Filter recent workbooks to only show those that still exist
  const validRecentWorkbooks = recentWorkbooks
    .filter((path) => files.some((f) => f.path === path))
    .map((path) => files.find((f) => f.path === path))
    .filter(Boolean) as Workbook[];

  return (
    <aside className="w-72 border-r border-blue-200 bg-gradient-to-b from-blue-50/80 to-indigo-50/80 backdrop-blur-md flex flex-col min-h-0">
      <div className="p-4 border-b border-blue-200/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-blue-900">Workbooks</h2>
          <div className="flex items-center gap-2">
            <Tooltip content="Select a folder containing Excel files">
              <button
                onClick={onPickFolder}
                aria-label="Choose Folder"
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                disabled={!onPickFolder}>
                <FolderOpen size={14} />
                Choose Folder
              </button>
            </Tooltip>
            <Tooltip content="Refresh file list">
              <button
                onClick={onRefresh}
                aria-label="Refresh"
                className="p-2 rounded-lg hover:bg-blue-100 text-blue-700 hover:text-blue-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
                <RefreshCw size={16} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Recent Workbooks Section */}
      {validRecentWorkbooks.length > 0 && (
        <div className="px-4 pb-4">
          <h3 className="text-sm font-medium text-blue-800 mb-3">
            Recent Files
          </h3>
          <div className="space-y-2">
            {validRecentWorkbooks.slice(0, 3).map((f) => (
              <Tooltip
                key={f.path ?? f.name}
                content={`Open ${f.name} (${Math.round(
                  (f.size || 0) / 1024
                )} KB)`}>
                <button
                  onClick={() => onOpen && onOpen(f)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    activePath === f.path
                      ? "bg-blue-100 border-blue-300 shadow-sm"
                      : "border-blue-200/50 hover:bg-blue-50 hover:border-blue-300"
                  }`}>
                  <FileSpreadsheet size={16} className="text-blue-600 flex-shrink-0" />
                  <div className="flex-1 truncate">
                    <div className="font-medium text-blue-900 truncate text-sm">{f.name}</div>
                    <div className="text-xs text-blue-600">
                      {f.mtimeMs
                        ? new Date(f.mtimeMs).toLocaleDateString()
                        : ""}
                    </div>
                  </div>
                  {f.macro && (
                    <span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-medium text-white">
                      xlsm
                    </span>
                  )}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* All Files Section */}
      <div className="px-4 pb-2 border-b border-blue-200/50">
        <h3 className="text-sm font-medium text-blue-800">
          All Files ({files.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
        {files.length === 0 ? (
          <div className="p-6 text-center">
            <File size={32} className="mx-auto text-blue-400 mb-2" />
            <p className="text-sm text-blue-600">No Excel files found</p>
            <p className="text-xs text-blue-500 mt-1">Choose a folder to get started</p>
          </div>
        ) : (
          files.map((f) => (
            <Tooltip
              key={f.path ?? f.name}
              content={`Open ${f.name} - Last modified: ${
                f.mtimeMs ? new Date(f.mtimeMs).toLocaleString() : "Unknown"
              }`}>
              <button
                onClick={() => onOpen && onOpen(f)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  activePath === f.path
                    ? "bg-blue-100 border-blue-300 shadow-sm"
                    : "border-blue-200/50 hover:bg-blue-50 hover:border-blue-300"
                }`}>
                <FileSpreadsheet size={16} className="text-blue-600 flex-shrink-0" />
                <div className="flex-1 truncate">
                  <div className="font-medium text-blue-900 truncate text-sm">{f.name}</div>
                  <div className="text-xs text-blue-600">
                    {Math.round((f.size || 0) / 1024)} KB •{" "}
                    {f.mtimeMs ? new Date(f.mtimeMs).toLocaleDateString() : ""}
                  </div>
                </div>
                {f.macro && (
                  <span className="rounded-full bg-amber-500 px-2 py-1 text-[10px] font-medium text-white">
                    xlsm
                  </span>
                )}
              </button>
            </Tooltip>
          ))
        )}
      </div>
    </aside>
  );
}
