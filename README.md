# Excel-as-Database (Electron) — Starter

This is a minimal starter scaffold for the Excel-as-Database Electron app (v1).

What is included:

- Electron main process (`src/main.js`) with IPC handlers
- Preload script exposing safe IPC to renderer (`src/preload.js`)
- Minimal renderer using plain React (`src/renderer/*`) that lists Excel files in a folder
- Basic `excelService` stub (`src/electron/excelService.js`) that scans a folder for `.xlsx`/`.xlsm`
- `config.json` with defaults

Quick start (requires Node.js and npm/yarn):

Install dependencies:

```bash
npm install
```

Run the app:

````bash
# Excel Database Electron

Small Electron app which treats Excel workbooks as simple databases.

Quick start (macOS / zsh):

```bash
# install dependencies
npm install

# run the app
npm start

# run unit-like tests added to the repo
npm test
````

Notes:

- The renderer loads small UMD React builds; we avoid a bundler by using plain scripts in `src/renderer`.
- `src/renderer/rowUtils.js` contains shared normalization/validation helpers used by the UI and tests.
- If you plan to bundle the renderer (recommended for production), import `rowUtils` as a module and remove the global `window.RowUtils` pattern.
