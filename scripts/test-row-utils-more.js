const {
  normalizeRowForSubmit,
  validateRow,
  typeHintForColumn,
} = require("../src/renderer/rowUtils");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function run() {
  console.log("Edge case tests start");

  // 1. Null/undefined handling -> becomes empty string for headers
  const headers1 = ["a", "b", "c"];
  const row1 = { a: null, b: undefined, c: "ok", extra: 5 };
  const out1 = normalizeRowForSubmit(row1, headers1);
  assert(out1.a === "", "null should become empty string for header a");
  assert(out1.b === "", "undefined should become empty string for header b");
  // extra should be preserved
  assert(out1.extra === 5, "extra fields should be preserved");

  // 2. Checkbox normalization from various truthy/falsey values
  const headers2 = ["is_active"];
  const r2a = normalizeRowForSubmit({ is_active: "true" }, headers2);
  const r2b = normalizeRowForSubmit({ is_active: 0 }, headers2);
  const r2c = normalizeRowForSubmit({ is_active: 1 }, headers2);
  assert(r2a.is_active === true, 'string "true" should normalize to true');
  assert(r2b.is_active === false, "0 should normalize to false");
  assert(r2c.is_active === true, "1 should normalize to true");

  // 3. Date invalid remains original, and validateRow catches invalid date
  const headers3 = ["created_at"];
  const r3 = normalizeRowForSubmit({ created_at: "not-a-date" }, headers3);
  assert(
    r3.created_at === "not-a-date",
    "invalid date should be left as-is in normalize"
  );
  const v3 = validateRow({ created_at: "not-a-date" }, headers3);
  assert(
    v3.created_at === "Invalid date",
    "validateRow should flag invalid date"
  );

  // 4. Number parsing - empty string stays empty, invalid flagged
  const headers4 = ["price"];
  const r4a = normalizeRowForSubmit({ price: "" }, headers4);
  assert(r4a.price === "", "empty number field should remain empty string");
  const v4 = validateRow({ price: "NaNish" }, headers4);
  assert(
    v4.price === "Must be a number",
    "validateRow should flag invalid number"
  );

  // 5. Required field detection: headers with '*' or '(required)'
  const headers5a = ["id*"];
  const v5a = validateRow({ "id*": "" }, headers5a);
  assert(v5a["id*"] === "Required", "header ending with * should be required");
  const headers5b = ["name (required)"];
  const v5b = validateRow({ "name (required)": null }, headers5b);
  assert(
    v5b["name (required)"] === "Required",
    "header with (required) should be required"
  );

  // 6. Headers absent: normalize should use keys from row
  const r6 = normalizeRowForSubmit({ foo: "bar" }, []);
  assert(
    r6.foo === "bar",
    "normalize should include non-header keys when headers empty"
  );

  // 7. Large number string
  const r7 = normalizeRowForSubmit({ amount: "123456789012345" }, ["amount"]);
  assert(
    typeof r7.amount === "number" && r7.amount === 123456789012345,
    "large integer should parse to number"
  );

  console.log("All extended tests passed");
}

try {
  run();
} catch (e) {
  console.error("TEST_FAIL", e.message);
  process.exit(2);
}
