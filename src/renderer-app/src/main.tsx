import { createRoot } from "react-dom/client";
// Use explicit extension to help some editors/TS language servers resolve the module
import App from "./App";
import "./index.css";

// These imports are for global window exposure only
import CrudModal from "./components/CrudModal";
import DataGrid from "./components/DataGrid";
import SheetTabs from "./components/SheetTabs";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";

// Expose components to the global window for compatibility with the legacy UMD App
if (typeof window !== "undefined") {
  (window as any).Sidebar = Sidebar;
  (window as any).SheetTabs = SheetTabs;
  (window as any).DataGrid = DataGrid;
  (window as any).CrudModal = CrudModal;
  (window as any).Toast = Toast;

  // If the preload exposes a forwarder, hook console methods so logs are sent to main
  try {
    const fwd = (window as any).api && (window as any).api._forwardConsole;
    if (typeof fwd === "function") {
      // avoid double-wrapping during HMR / reloads
      if (!(console as any).__forwarderWrapped) {
        (console as any).__forwarderWrapped = true;

        // safe serializer to avoid JSON.stringify throwing on circular refs
        const safeSerialize = (v: any) => {
          try {
            if (typeof v === "string") return v;
            if (typeof v === "object" && v !== null) {
              const seen = new WeakSet();
              return JSON.stringify(v, function (_key: string, value: any) {
                if (typeof value === "object" && value !== null) {
                  if (seen.has(value)) return "[Circular]";
                  seen.add(value);
                }
                return value;
              });
            }
            return String(v);
          } catch (e) {
            try {
              return String(v);
            } catch (e2) {
              return "[unserializable]";
            }
          }
        };

        ["log", "info", "warn", "error"].forEach((m) => {
          const orig = (console as any)[m] as (...a: any[]) => void;
          (console as any)[m] = (...args: any[]) => {
            try {
              // truncate long serialized outputs to avoid blocking and huge messages
              const serialized = args.map((a) => {
                const s = safeSerialize(a);
                if (typeof s === "string" && s.length > 2000)
                  return s.slice(0, 2000) + "...[truncated]";
                return s;
              });
              fwd(m, ...serialized);
            } catch (e) {
              // ignore
            }
            // use apply to avoid TS spread tuple issues
            (orig as any).apply(console, args);
          };
        });
      }
    }
  } catch (e) {
    // noop
  }
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
} else {
  // graceful failure for test environments or unexpected hosting
  console.error("#root element not found — React mount skipped");
}
