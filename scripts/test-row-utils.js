const {
  normalizeRowForSubmit,
  validateRow,
  typeHintForColumn,
} = require("../src/renderer/rowUtils");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function run() {
  console.log("Testing type hints...");
  assert(typeHintForColumn("created_at") === "date");
  assert(typeHintForColumn("price") === "number");
  assert(typeHintForColumn("is_active") === "checkbox");
  assert(typeHintForColumn("name") === "text");

  console.log("Testing normalize...");
  const headers = ["id", "name", "price", "is_active", "created_at"];
  const input = {
    id: "123",
    name: "Bob",
    price: "12.5",
    is_active: "true",
    created_at: "2020-01-02",
  };
  const out = normalizeRowForSubmit(input, headers);
  assert(
    typeof out.price === "number" && out.price === 12.5,
    "price not normalized"
  );
  assert(
    typeof out.is_active === "boolean" && out.is_active === true,
    "checkbox not normalized"
  );
  assert(
    new Date(out.created_at).toISOString().startsWith("2020-01-02"),
    "date not normalized"
  );

  console.log("Testing validation...");
  const v1 = validateRow({ id: "", price: "abc" }, headers);
  assert(v1.price === "Must be a number", "price validation failed");

  const v2 = validateRow({ id: "" }, ["id*"]);
  assert(
    v2["id*"] === "Required" || v2["id*"] === "Required",
    "required validation failed"
  );

  console.log("All tests passed");
}

try {
  run();
} catch (e) {
  console.error("TEST_FAIL", e.message);
  process.exit(2);
}
