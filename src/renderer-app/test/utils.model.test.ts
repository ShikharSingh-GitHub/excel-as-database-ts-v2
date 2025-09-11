import { describe, expect, it } from "vitest";
import { crudPolicyFor, detectPkField } from "../src/utils/model";
import { inferShape } from "../src/utils/shape";

describe("detectPkField", () => {
  it("finds id field when unique", () => {
    const rows = [
      { id: 1, v: 2 },
      { id: 2, v: 3 },
    ];
    expect(detectPkField(rows)).toBe("id");
  });

  it("returns null when no unique field", () => {
    const rows = [{ a: 1 }, { a: 1 }];
    expect(detectPkField(rows)).toBeNull();
  });
});

describe("crudPolicyFor", () => {
  it("makes scalar editable", () => {
    const s = inferShape(5, "r");
    expect(crudPolicyFor(5, s).editable).toBe(true);
  });

  it("array-objects requires PK", () => {
    const rows = [{ a: 1 }, { a: 2 }];
    const shape = inferShape(rows, "r");
    const policy = crudPolicyFor(rows, shape);
    expect(policy.editable).toBe(false);
    expect(policy.reason).toBeDefined();
  });

  it("array-objects with id is editable", () => {
    const rows = [
      { id: 1, x: 1 },
      { id: 2, x: 2 },
    ];
    const shape = inferShape(rows, "r");
    const policy = crudPolicyFor(rows, shape);
    expect(policy.editable).toBe(true);
    expect(policy.pkField).toBe("id");
  });
});
