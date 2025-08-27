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
    <aside className="w-72 border-r border-slate-200 bg-white/60 p-4 backdrop-blur-md dark:border-slate-800 dark:bg-white/5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">Workbooks</h2>
        <div className="flex items-center gap-2">
          <Tooltip content="Select a folder containing Excel files">
            <button
              onClick={onPickFolder}
              aria-label="Choose Folder"
              className="px-2 py-1 rounded bg-gray-200 text-xs hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700"
              disabled={!onPickFolder}>
              Choose Folder
            </button>
          </Tooltip>
          <Tooltip content="Refresh file list">
            <button
              onClick={onRefresh}
              aria-label="Refresh"
              className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
              ⟳
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Recent Workbooks Section */}
      {validRecentWorkbooks.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            Recent
          </h3>
          <div className="space-y-1">
            {validRecentWorkbooks.slice(0, 3).map((f) => (
              <Tooltip key={f.path ?? f.name} content={`Open ${f.name} (${Math.round((f.size || 0) / 1024)} KB)`}>
                <button
                  onClick={() => onOpen && onOpen(f)}
                  className={`flex w-full items-center gap-2 rounded-lg border border-transparent p-2 text-left text-xs transition hover:border-violet-400 focus:outline-none ${
                    activePath === f.path
                      ? "bg-violet-50 dark:bg-violet-900/40"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}>
                  <div className="flex-1 truncate">
                    <div className="font-medium truncate">{f.name}</div>
                    <div className="text-xs text-slate-500">
                      {f.mtimeMs ? new Date(f.mtimeMs).toLocaleDateString() : ""}
                    </div>
                  </div>
                  {f.macro && (
                    <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
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
      <div className="mb-2">
        <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          All Files ({files.length})
        </h3>
      </div>

      <div className="space-y-2 overflow-y-auto h-[calc(100vh-200px)] pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500" style={{ scrollbarWidth: 'thin' }}>
        {files.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No files</div>
        ) : (
          files.map((f) => (
            <Tooltip key={f.path ?? f.name} content={`Open ${f.name} - Last modified: ${f.mtimeMs ? new Date(f.mtimeMs).toLocaleString() : 'Unknown'}`}>
              <button
                onClick={() => onOpen && onOpen(f)}
                className={`mb-2 flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left text-sm transition hover:border-violet-400 focus:outline-none ${
                  activePath === f.path
                    ? "bg-violet-50 dark:bg-violet-900/40"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}>
                <div className="flex-1 truncate">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-xs text-slate-500">
                    {Math.round((f.size || 0) / 1024)} KB •{" "}
                    {f.mtimeMs ? new Date(f.mtimeMs).toLocaleDateString() : ""}
                  </div>
                </div>
                {f.macro && (
                  <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
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
