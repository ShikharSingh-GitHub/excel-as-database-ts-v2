import { describe, expect, it } from "vitest";
import { inferShape } from "../src/utils/shape";

describe("inferShape", () => {
  it("detects scalar", () => {
    expect(inferShape(5, "root").kind).toBe("scalar");
    expect(inferShape(null, "root").kind).toBe("scalar");
  });

  it("detects array-scalars", () => {
    expect(inferShape([1, 2, 3], "a").kind).toBe("array-scalars");
  });

  it("detects array-objects and computes columns", () => {
    const arr = [
      { id: 1, name: "a" },
      { id: 2, name: "b", extra: true },
    ];
    const s = inferShape(arr, "d");
    expect(s.kind).toBe("array-objects");
    expect(s.stats).toBeDefined();
    expect(s.stats!.columns).toEqual(
      expect.arrayContaining(["id", "name", "extra"])
    );
  });

  it("detects object", () => {
    expect(inferShape({ a: 1, b: { c: 2 } }, "r").kind).toBe("object");
  });
});
