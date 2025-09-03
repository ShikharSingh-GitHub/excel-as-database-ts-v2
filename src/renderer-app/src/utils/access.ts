// utils/access.ts
export type Path = (string | number)[];

export function parsePath(expr: string): Path {
  const out: Path = [];
  let i = 0,
    buf = "";
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ".") {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      i++;
      continue;
    }
    if (ch === "[") {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      const end = expr.indexOf("]", i + 1);
      const key = expr.slice(i + 1, end);
      out.push(/^\d+$/.test(key) ? Number(key) : key.replace(/^"(.*)"$/, "$1"));
      i = end + 1;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf) out.push(buf);
  return out;
}

export function getAt(obj: any, path: Path, def?: any) {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return def;
    cur = (cur as any)[k as any];
  }
  return cur === undefined ? def : cur;
}

export function setAt(obj: any, path: Path, value: any) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (cur[k as any] == null || typeof cur[k as any] !== "object") {
      (cur as any)[k as any] = typeof path[i + 1] === "number" ? [] : {};
    }
    cur = (cur as any)[k as any];
  }
  (cur as any)[path[path.length - 1] as any] = value;
  return obj;
}
