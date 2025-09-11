const isScalar = (v: any) => v == null || typeof v !== "object";
const preview = (v: any) =>
  v == null
    ? ""
    : Array.isArray(v)
    ? `[${v.length}]`
    : typeof v === "object"
    ? "{…}"
    : String(v);

export type NodeKind =
  | "scalar"
  | "object"
  | "array-scalars"
  | "array-objects"
  | "array-mixed";

export type ArrayObjectsStats = {
  columns: string[];
  coverage: Record<string, number>;
  leaf: boolean;
};

export type NodeShape = {
  kind: NodeKind;
  path: string;
  size?: number;
  stats?: ArrayObjectsStats;
};

export function inferShape(value: any, path: string): NodeShape {
  if (isScalar(value)) return { kind: "scalar", path };

  if (Array.isArray(value)) {
    const n = value.length;
    if (n === 0) return { kind: "array-scalars", path, size: 0 };

    const allScalars = value.every(isScalar);
    if (allScalars) return { kind: "array-scalars", path, size: n };

    const allObjects = value.every(
      (v) => v && typeof v === "object" && !Array.isArray(v)
    );
    if (allObjects) {
      const sample = value.slice(0, 200) as Record<string, any>[];
      const keySet = new Set<string>();
      const counts: Record<string, number> = {};
      let leaf = true;

      for (const row of sample) {
        for (const k of Object.keys(row)) {
          keySet.add(k);
          counts[k] = (counts[k] || 0) + 1;
          if (!isScalar(row[k])) leaf = false;
        }
      }
      const columns = [...keySet];
      const coverage: Record<string, number> = {};
      for (const k of columns) coverage[k] = counts[k] / sample.length;

      return {
        kind: "array-objects",
        path,
        size: n,
        stats: { columns, coverage, leaf },
      };
    }

    return { kind: "array-mixed", path, size: n };
  }

  const keys = Object.keys(value);
  return { kind: "object", path, size: keys.length };
}

export { isScalar, preview };
