import React from "react";

export type Workbook = {
  name: string;
  path?: string;
  size?: number;
  mtimeMs?: number;
  macro?: boolean;
};

export default function Sidebar({
  files = [],
  activePath,
  onOpen,
  onRefresh,
}: {
  files?: Workbook[];
  activePath?: string | null;
  onOpen?: (f: Workbook) => void;
  onRefresh?: () => void;
}) {
  return (
    <aside className="w-72 border-r border-slate-200 bg-white/60 p-4 backdrop-blur-md dark:border-slate-800 dark:bg-white/5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium">Workbooks</h2>
        <button
          onClick={onRefresh}
          aria-label="Refresh"
          className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
          ⟳
        </button>
      </div>

      <div className="space-y-2 overflow-auto h-[calc(100vh-140px)] pr-2">
        {files.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">No files</div>
        ) : (
          files.map((f) => (
            <button
              key={f.path ?? f.name}
              onClick={() => onOpen && onOpen(f)}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left text-sm transition hover:border-violet-400 focus:outline-none ${
                activePath === f.path
                  ? "bg-violet-50 dark:bg-violet-900/40"
                  : ""
              }`}>
              <div className="flex-1 truncate">
                <div className="font-medium truncate">{f.name}</div>
                <div className="text-xs text-slate-500">
                  {Math.round((f.size || 0) / 1024)} KB
                </div>
              </div>
              {f.macro && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                  xlsm
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
