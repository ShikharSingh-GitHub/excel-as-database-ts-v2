import { NodeShape } from "./shape";

const PK_REGEX = /\b(id|uuid)\b/i;

export function detectPkField(
  rows: any[],
  candidates?: string[]
): string | null {
  if (!rows.length) return null;
  const keys = new Set<string>();
  for (const r of rows.slice(0, 200))
    Object.keys(r).forEach((k) => keys.add(k));
  const prefs = candidates?.length
    ? candidates
    : [...keys].filter((k) => PK_REGEX.test(k) || /Id$/.test(k));
  for (const k of prefs) {
    const seen = new Set<any>();
    let ok = true;
    for (const r of rows) {
      const v = r?.[k];
      if (v == null || seen.has(v)) {
        ok = false;
        break;
      }
      seen.add(v);
    }
    if (ok) return k;
  }
  return null;
}

export type CrudPolicy = {
  editable: boolean;
  rowAdd?: boolean;
  rowDelete?: boolean;
  pkField?: string | null;
  reason?: string;
};

export function crudPolicyFor(
  value: any,
  shape: NodeShape,
  opts: {
    allowIndexMutations?: boolean;
    declaredPkByPath?: Record<string, string>;
  } = {}
): CrudPolicy {
  const { declaredPkByPath, allowIndexMutations } = opts;

  if (shape.kind === "scalar") return { editable: true };
  if (shape.kind === "object") return { editable: true };
  if (shape.kind === "array-scalars") {
    return {
      editable: true,
      rowAdd: !!allowIndexMutations,
      rowDelete: !!allowIndexMutations,
    };
  }
  if (shape.kind === "array-objects") {
    const rows = Array.isArray(value) ? value : [];
    if (!shape.stats?.leaf)
      return { editable: false, reason: "Not a leaf array" };
    const declaredPk = opts.declaredPkByPath?.[shape.path];
    const pkField = declaredPk ?? detectPkField(rows);
    if (!pkField)
      return { editable: false, reason: "No natural PK", pkField: null };
    return { editable: true, rowAdd: true, rowDelete: true, pkField };
  }

  return { editable: false, reason: "Mixed array" };
}
