// utils/schema.ts
type Shape = "scalar" | "arrayScalar" | "arrayObject" | "object";

function isScalar(v: any) {
  return v == null || typeof v !== "object";
}

function isArrayOfScalars(a: any[]) {
  return a.every(isScalar);
}

export type SchemaSummary = {
  scalarPaths: Set<string>;
  arrayScalarPaths: Set<string>;
  arrayObjectPaths: Set<string>;
  objectPaths: Set<string>;
};

export function collectPaths(
  rows: any[],
  maxDepth = 6,
  maxScan = 200
): SchemaSummary {
  const scalarPaths = new Set<string>();
  const arrayScalarPaths = new Set<string>();
  const arrayObjectPaths = new Set<string>();
  const objectPaths = new Set<string>();

  function walk(val: any, prefix: string, depth: number) {
    if (depth > maxDepth) return;

    if (Array.isArray(val)) {
      if (isArrayOfScalars(val)) {
        arrayScalarPaths.add(prefix);
      } else {
        arrayObjectPaths.add(prefix);
      }
      return;
    }

    if (val && typeof val === "object") {
      const keys = Object.keys(val);
      if (keys.length === 0) {
        objectPaths.add(prefix);
        return;
      }
      for (const k of keys) {
        const p = prefix ? `${prefix}.${k}` : k;
        walk((val as any)[k], p, depth + 1);
      }
      return;
    }

    // scalar
    if (prefix) scalarPaths.add(prefix);
  }

  for (const r of rows.slice(0, maxScan)) {
    walk(r, "", 0);
  }

  return { scalarPaths, arrayScalarPaths, arrayObjectPaths, objectPaths };
}
