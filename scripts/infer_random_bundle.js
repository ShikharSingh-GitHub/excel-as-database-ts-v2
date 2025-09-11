const fs = require("fs");
const path = require("path");
const bundle = path.join(process.cwd(), "random_json_bundle");
const files = fs.readdirSync(bundle);
function isScalar(v) {
  return v == null || typeof v !== "object";
}
function inferShape(val, name) {
  if (Array.isArray(val)) {
    if (val.length === 0) return { kind: "array-empty", size: 0 };
    const sample = val.slice(0, 200);
    const allObj = sample.every(
      (s) => s && typeof s === "object" && !Array.isArray(s)
    );
    const allScalar = sample.every((s) => isScalar(s));
    if (allObj) {
      const keySet = new Set();
      sample.forEach((s) => Object.keys(s || {}).forEach((k) => keySet.add(k)));
      return {
        kind: "array-objects",
        size: val.length,
        columns: [...keySet].slice(0, 50),
      };
    }
    if (allScalar) return { kind: "array-scalars", size: val.length };
    return { kind: "array-mixed", size: val.length };
  }
  if (val && typeof val === "object")
    return { kind: "object", size: Object.keys(val).length };
  return { kind: "scalar" };
}
function detectPkField(rows) {
  if (!Array.isArray(rows)) return null;
  const sample = rows.slice(0, 200);
  if (sample.length === 0) return null;
  const keyList = Object.keys(sample[0] || {});
  for (const k of keyList) {
    const s = new Set();
    let ok = true;
    for (const r of sample) {
      if (r == null || typeof r !== "object") {
        ok = false;
        break;
      }
      s.add(String(r[k]));
    }
    if (ok && s.size === sample.length) return k;
  }
  const common = ["id", "uuid", "ID"];
  for (const c of common) if (keyList.includes(c)) return c;
  return null;
}
function crudPolicy(val, shape) {
  if (shape.kind === "scalar") return { editable: true };
  if (shape.kind === "array-objects") {
    const pk = detectPkField(val);
    return { editable: !!pk, pkField: pk };
  }
  return { editable: false };
}
for (const f of files) {
  try {
    const p = path.join(bundle, f);
    const raw = fs.readFileSync(p, "utf8");
    if (f.endsWith(".jsonl")) {
      console.log(f, "(jsonl) -> skip");
      continue;
    }
    const j = JSON.parse(raw);
    const root = j && typeof j === "object" && j.data ? j.data : j;
    const shape = inferShape(root, f);
    const policyRes = crudPolicy(root, shape);
    console.log("\n===", f, "===");
    console.log("shape:", shape);
    console.log("policy:", policyRes);
  } catch (e) {
    console.log("ERR", f, e.message);
  }
}
