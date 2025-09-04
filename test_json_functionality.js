// Test script to verify JSON functionality
const fs = require("fs");
const path = require("path");

// Test JSON file structure
const testJson = {
  users: [
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      age: 30,
      address: {
        street: "123 Main St",
        city: "New York",
        country: "USA",
      },
      hobbies: ["reading", "gaming", "cooking"],
    },
    {
      id: 2,
      name: "Jane Smith",
      email: "jane@example.com",
      age: 25,
      address: {
        street: "456 Oak Ave",
        city: "Los Angeles",
        country: "USA",
      },
      hobbies: ["swimming", "hiking"],
    },
  ],
  products: [
    {
      id: "prod-1",
      name: "Laptop",
      price: 999.99,
      category: "Electronics",
      inStock: true,
      specifications: {
        ram: "16GB",
        storage: "512GB SSD",
        processor: "Intel i7",
      },
    },
    {
      id: "prod-2",
      name: "Mouse",
      price: 29.99,
      category: "Electronics",
      inStock: false,
      specifications: {
        type: "Wireless",
        dpi: 1600,
      },
    },
  ],
  settings: {
    theme: "dark",
    language: "en",
    notifications: true,
    features: ["search", "filter", "export"],
  },
};

// Test JSON parser logic
function testJsonParser() {
  console.log("🧪 Testing JSON Parser Logic...");

  // Simulate the JsonParserService logic
  function findTableCandidates(data, level = 0) {
    const candidates = [];

    if (level >= 6) return candidates; // maxDepth

    if (Array.isArray(data) && data.length > 0) {
      const firstChild = data[0];
      if (typeof firstChild === "object" && data.length >= 1) {
        candidates.push({
          type: "array",
          data: data,
          level: level,
          key: "array",
        });
      }
    }

    if (typeof data === "object" && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        candidates.push(...findTableCandidates(value, level + 1));
      }
    }

    return candidates;
  }

  const candidates = findTableCandidates(testJson);
  console.log(
    `✅ Found ${candidates.length} table candidates:`,
    candidates.map((c) => ({
      type: c.type,
      level: c.level,
      key: c.key,
      dataLength: Array.isArray(c.data) ? c.data.length : "N/A",
    }))
  );

  return candidates;
}

// Test file scanning logic
function testFileScanning() {
  console.log("🧪 Testing File Scanning Logic...");

  function isVisibleFile(filename) {
    const lower = String(filename || "").toLowerCase();
    return (
      (lower.endsWith(".xlsx") ||
        lower.endsWith(".xlsm") ||
        lower.endsWith(".json")) &&
      !String(filename).startsWith(".")
    );
  }

  const testFiles = [
    "sample.json",
    "data.xlsx",
    "workbook.xlsm",
    ".hidden.json",
    "config.txt",
    "users.json",
  ];

  const visibleFiles = testFiles.filter(isVisibleFile);
  console.log(`✅ Visible files: ${visibleFiles.join(", ")}`);

  return visibleFiles;
}

// Run tests
console.log("🚀 Starting JSON Functionality Tests...\n");

const tableCandidates = testJsonParser();
console.log("");

const visibleFiles = testFileScanning();
console.log("");

console.log("📊 Test Results Summary:");
console.log(`- Table candidates found: ${tableCandidates.length}`);
console.log(`- Visible files: ${visibleFiles.length}`);
console.log(
  `- JSON files detected: ${
    visibleFiles.filter((f) => f.endsWith(".json")).length
  }`
);

console.log("\n✅ JSON functionality tests completed!");
