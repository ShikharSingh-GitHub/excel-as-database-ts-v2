// Test CRUD-enabled JSON file
const { getJsonSchema } = require("./src/main.js");
const path = require("path");

const testFile = path.join(__dirname, "test_data", "employees_crud.json");

console.log("🧪 Testing CRUD-enabled JSON file...\n");

const schema = getJsonSchema(testFile);
console.log("Schema analysis:");
console.log(JSON.stringify(schema, null, 2));

console.log("\n📊 CRUD Analysis:");
Object.entries(schema.byPath).forEach(([path, info]) => {
  console.log(`\n📍 Path: ${path}`);
  console.log(`  Type: ${info.type}`);
  console.log(`  Columns: [${info.columns.join(", ")}]`);
  console.log(`  Is Leaf: ${info.isLeaf}`);
  console.log(`  Primary Key: ${info.pkField}`);
  console.log(`  CRUD Enabled: ${info.allowCrud ? "✅ YES" : "❌ NO"}`);
  console.log(`  Row Count: ${info.itemCount}`);
});

console.log("\n✨ Analysis complete!");
console.log(
  "✅ This file should be CRUD-enabled in the CollapsibleJsonView component."
);
