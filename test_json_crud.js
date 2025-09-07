// Test script for JSON CRUD functionality
const fs = require("fs");
const path = require("path");

// Import the main process functions (simulated)
const {
  getAtPath,
  setAtPath,
  getJsonSchema,
  parsePath,
} = require("./src/main.js");

// Test data
const sampleJsonPath = path.join(__dirname, "test_data", "sample.json");
const testFilePath = path.join(__dirname, "test_data", "test_crud.json");

console.log("🧪 Testing JSON CRUD functionality...\n");

// Copy sample to test file
try {
  const sampleData = fs.readFileSync(sampleJsonPath, "utf8");
  fs.writeFileSync(testFilePath, sampleData);
  console.log("✅ Test file created:", testFilePath);
} catch (e) {
  console.error("❌ Failed to create test file:", e.message);
  process.exit(1);
}

// Test schema analysis
console.log("\n🔍 Analyzing JSON schema...");
try {
  const schema = getJsonSchema(testFilePath);
  console.log("Schema analysis results:");
  console.log(JSON.stringify(schema, null, 2));
} catch (e) {
  console.error("❌ Schema analysis failed:", e.message);
}

// Test path parsing
console.log("\n🧭 Testing path parsing...");
const testPaths = [
  "users",
  "users[0]",
  "users[0].name",
  "users[1].address.city",
  "products[2].details.specs[0]",
];

testPaths.forEach((testPath) => {
  try {
    const parts = parsePath(testPath);
    console.log(
      `"${testPath}" → [${parts
        .map((p) => (typeof p === "number" ? `${p}` : `"${p}"`))
        .join(", ")}]`
    );
  } catch (e) {
    console.error(`❌ Failed to parse "${testPath}":`, e.message);
  }
});

// Test value access
console.log("\n📖 Testing value access...");
try {
  const data = JSON.parse(fs.readFileSync(testFilePath, "utf8"));

  const testReads = [
    "users",
    "users[0].name",
    "users[1].email",
    "users[0].address.city",
  ];

  testReads.forEach((testPath) => {
    try {
      const value = getAtPath(data, testPath);
      console.log(`${testPath} = ${JSON.stringify(value)}`);
    } catch (e) {
      console.error(`❌ Failed to read "${testPath}":`, e.message);
    }
  });
} catch (e) {
  console.error("❌ Failed to read test data:", e.message);
}

// Test value updates
console.log("\n✏️  Testing value updates...");
try {
  let data = JSON.parse(fs.readFileSync(testFilePath, "utf8"));

  // Update a user's name
  console.log("Before update:", getAtPath(data, "users[0].name"));
  setAtPath(data, "users[0].name", "John Updated");
  console.log("After update:", getAtPath(data, "users[0].name"));

  // Update nested value
  console.log("Before city update:", getAtPath(data, "users[1].address.city"));
  setAtPath(data, "users[1].address.city", "San Francisco");
  console.log("After city update:", getAtPath(data, "users[1].address.city"));

  // Save updated data
  fs.writeFileSync(testFilePath, JSON.stringify(data, null, 2));
  console.log("✅ Updates saved to test file");
} catch (e) {
  console.error("❌ Failed to update values:", e.message);
}

console.log("\n✨ JSON CRUD test completed!");
console.log(
  "You can now integrate the enhanced CollapsibleJsonView component with a JSON file."
);
console.log(
  "The component will automatically detect CRUD-enabled arrays and show edit controls."
);
