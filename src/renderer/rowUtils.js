// Shim file to preserve compatibility with existing test scripts
// The real legacy implementation is archived in archived_components/legacy_renderer
// Re-export it here so scripts that `require('../src/renderer/rowUtils')` continue to work.
module.exports = require("../../archived_components/legacy_renderer/rowUtils");
// Utility functions extracted from App.js for testing and reuse
function typeHintForColumn(col) {
  const lc = String(col || "").toLowerCase();
  if (lc.includes("date") || lc.includes("dob") || lc.includes("_at"))
    return "date";
  if (
    lc.includes("qty") ||
    lc.includes("price") ||
    lc.includes("amount") ||
    lc.endsWith("_id")
  )
    return "number";
  if (
    lc.startsWith("is") ||
    lc.startsWith("has") ||
    lc.startsWith("active") ||
    lc.startsWith("enabled")
  )
    return "checkbox";
  return "text";
}

function normalizeRowForSubmit(row, headers) {
  if (!row) return row;
  const usedHeaders = headers && headers.length ? headers : Object.keys(row);
  const out = {};
  usedHeaders.forEach((h) => {
    const t = typeHintForColumn(h);
    let v = row[h];
    if (v === undefined || v === null) {
      out[h] = "";
      return;
    }
    if (t === "number") {
      if (v === "" || v === null) {
        out[h] = "";
      } else {
        const n = Number(v);
        out[h] = Number.isNaN(n) ? v : n;
      }
      return;
    }
    if (t === "checkbox") {
      out[h] = !!v;
      return;
    }
    if (t === "date") {
      if (!v) {
        out[h] = "";
      } else {
        const d = new Date(v);
        out[h] = isNaN(d.getTime()) ? v : d.toISOString();
      }
      return;
    }
    // default: text
    out[h] = v;
  });
  // include any non-header fields as-is
  Object.keys(row).forEach((k) => {
    if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = row[k];
  });
  return out;
}

function validateRow(row, headers) {
  const errors = {};
  const usedHeaders =
    headers && headers.length ? headers : Object.keys(row || {});
  usedHeaders.forEach((h) => {
    const isRequired =
      h && (String(h).trim().endsWith("*") || /\(required\)/i.test(String(h)));
    const t = typeHintForColumn(h);
    const v = row ? row[h] : undefined;
    if (isRequired) {
      if (v === "" || v === null || v === undefined) {
        errors[h] = "Required";
        return;
      }
    }
    if (t === "number") {
      if (v !== "" && v !== null && v !== undefined) {
        const n = Number(v);
        if (Number.isNaN(n)) errors[h] = "Must be a number";
      }
    }
    if (t === "date") {
      if (v) {
        const d = new Date(v);
        if (isNaN(d.getTime())) errors[h] = "Invalid date";
      }
    }
  });
  return errors;
}

// Export for Node (tests) and attach to window for browser usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = { typeHintForColumn, normalizeRowForSubmit, validateRow };
}
if (typeof window !== "undefined") {
  window.RowUtils = { typeHintForColumn, normalizeRowForSubmit, validateRow };
}
