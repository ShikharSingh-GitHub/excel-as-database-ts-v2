const { contextBridge, ipcRenderer } = require("electron");

// Forward renderer console messages to the main process for easier debugging
const forwardConsole = (level, ...args) => {
  try {
    ipcRenderer.send("renderer:console", { level, args });
  } catch (e) {
    // ignore
  }
};

contextBridge.exposeInMainWorld("api", {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  // helper to let renderer forward console calls
  _forwardConsole: forwardConsole,
});
