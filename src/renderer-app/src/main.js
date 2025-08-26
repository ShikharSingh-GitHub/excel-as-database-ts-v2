import { jsx as _jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import CrudModal from "./components/CrudModal";
import DataGrid from "./components/DataGrid";
import SheetTabs from "./components/SheetTabs";
import Sidebar from "./components/Sidebar";
import Toast from "./components/Toast";
// Expose components to the global window for compatibility with the legacy UMD App
if (typeof window !== "undefined") {
    window.Sidebar = Sidebar;
    window.SheetTabs = SheetTabs;
    window.DataGrid = DataGrid;
    window.CrudModal = CrudModal;
    window.Toast = Toast;
    // If the preload exposes a forwarder, hook console methods so logs are sent to main
    try {
        const fwd = window.api && window.api._forwardConsole;
        if (typeof fwd === "function") {
            // safe serializer to avoid JSON.stringify throwing on circular refs
            const safeSerialize = (v) => {
                try {
                    if (typeof v === "string")
                        return v;
                    if (typeof v === "object" && v !== null) {
                        const seen = new WeakSet();
                        return JSON.stringify(v, function (_key, value) {
                            if (typeof value === "object" && value !== null) {
                                if (seen.has(value))
                                    return "[Circular]";
                                seen.add(value);
                            }
                            return value;
                        });
                    }
                    return String(v);
                }
                catch (e) {
                    try {
                        return String(v);
                    }
                    catch (e2) {
                        return "[unserializable]";
                    }
                }
            };
            ["log", "info", "warn", "error"].forEach((m) => {
                const orig = console[m].bind(console);
                console[m] = (...args) => {
                    try {
                        fwd(m, ...args.map((a) => safeSerialize(a)));
                    }
                    catch (e) {
                        // ignore
                    }
                    // use apply to avoid TS spread tuple issues
                    orig.apply(console, args);
                };
            });
        }
    }
    catch (e) {
        // noop
    }
}
const rootEl = document.getElementById("root");
createRoot(rootEl).render(_jsx(App, {}));
//# sourceMappingURL=main.js.map