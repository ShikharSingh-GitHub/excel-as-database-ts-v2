// Use global React and ReactDOM (UMD) to avoid bundler dependency
const rootEl = document.getElementById("root");
const root = ReactDOM.createRoot(rootEl);
// App is loaded via a global function defined in App.js
console.log(window.ExcelDBApp);

// Debug log to confirm accessibility of ExcelDBApp
console.log("[DEBUG] window.ExcelDBApp:", window.ExcelDBApp);

root.render(React.createElement(window.ExcelDBApp));
