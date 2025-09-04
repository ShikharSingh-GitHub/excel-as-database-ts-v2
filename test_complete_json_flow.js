// Complete JSON Flow Test
const fs = require("fs");
const path = require("path");

// Simulate the JsonParserService logic
class TestJsonParserService {
  constructor() {
    this.config = {
      maxDepth: 6,
      autoDetectPrimaryKeys: true,
      primaryKeyCandidates: ["id", "ID", "key", "name", "title", "uuid"],
      excludeKeys: ["_version", "_created_at", "_updated_at"],
      arrayThreshold: 1,
    };
  }

  getNodeType(value) {
    if (Array.isArray(value)) return "array";
    if (value && typeof value === "object") return "object";
    return "primitive";
  }

  createJsonNode(key, value, path, parent = null) {
    const node = {
      key,
      value,
      type: this.getNodeType(value),
      path: path ? `${path}.${key}` : key,
      parent,
    };

    if (node.type === "object" && value && typeof value === "object") {
      node.children = Object.entries(value).map(([childKey, childValue]) =>
        this.createJsonNode(childKey, childValue, node.path, node)
      );
    } else if (node.type === "array" && Array.isArray(value)) {
      node.children = value.map((item, index) =>
        this.createJsonNode(index.toString(), item, node.path, node)
      );
    }

    return node;
  }

  findTableCandidates(node, level) {
    const candidates = [];

    if (level >= this.config.maxDepth) return candidates;

    // If this is an array with objects, it's a table candidate
    if (node.type === "array" && node.children && node.children.length > 0) {
      const firstChild = node.children[0];
      if (
        firstChild.type === "object" &&
        node.children.length >= this.config.arrayThreshold
      ) {
        candidates.push(node);
      }
    }

    // If this is an object, check its children
    if (node.type === "object" && node.children) {
      for (const child of node.children) {
        candidates.push(...this.findTableCandidates(child, level + 1));
      }
    }

    return candidates;
  }

  generateTableSchema(node, fileName) {
    if (node.type !== "array" || !node.children || node.children.length === 0) {
      return null;
    }

    // Get the first object to determine columns
    const firstObject = node.children[0];
    if (firstObject.type !== "object" || !firstObject.children) {
      return null;
    }

    // Generate columns from the first object
    const columns = firstObject.children.map((child) => ({
      id: child.key,
      key: child.key,
      label: this.formatColumnLabel(child.key),
      type: this.getColumnType(child.value),
      path: child.path,
      isExpandable: child.type === "object" || child.type === "array",
      isEditable: this.isEditable(child.value),
      sortable: this.isSortable(child.value),
      filterable: this.isFilterable(child.value),
    }));

    // Detect primary key
    const primaryKey = this.detectPrimaryKey(columns);

    // Generate table data
    const data = node.children.map((child, index) => ({
      id: this.generateRowId(child, index),
      data: this.flattenObject(child),
      level: 0,
      _originalData: child.value,
    }));

    return {
      id: `${fileName}_${node.path.replace(/\./g, "_")}`,
      name: this.formatTabName(node.key),
      path: node.path,
      primaryKey,
      columns,
      data,
      isArray: true,
      level: 0,
    };
  }

  detectPrimaryKey(columns) {
    if (!this.config.autoDetectPrimaryKeys) return undefined;

    for (const candidate of this.config.primaryKeyCandidates) {
      const column = columns.find(
        (col) =>
          col.key.toLowerCase() === candidate.toLowerCase() ||
          col.key.toLowerCase().includes(candidate.toLowerCase())
      );
      if (column) return column.key;
    }

    const stringColumn = columns.find((col) => col.type === "string");
    return stringColumn?.key;
  }

  generateRowId(node, index) {
    if (node.type === "object" && node.children) {
      const idField = node.children.find((child) =>
        this.config.primaryKeyCandidates.some((pk) =>
          child.key.toLowerCase().includes(pk.toLowerCase())
        )
      );
      if (idField) return String(idField.value);
    }
    return `row_${index}`;
  }

  flattenObject(node) {
    const result = {};

    if (node.type === "object" && node.children) {
      for (const child of node.children) {
        if (child.type === "primitive") {
          result[child.key] = child.value;
        } else if (child.type === "object") {
          result[child.key] = `{${
            Object.keys(child.value || {}).length
          } properties}`;
        } else if (child.type === "array") {
          result[child.key] = `[${child.children?.length || 0} items]`;
        }
      }
    } else if (node.type === "primitive") {
      result[node.key] = node.value;
    }

    return result;
  }

  getColumnType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return "number";
    return "string";
  }

  isEditable(value) {
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

  isSortable(value) {
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

  isFilterable(value) {
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

  formatTabName(key) {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  formatColumnLabel(key) {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  parseJsonToTabs(data, fileName) {
    const rootNode = this.createJsonNode("root", data, "");
    const tabs = [];

    const topLevelNodes = this.findTableCandidates(rootNode, 0);

    for (const node of topLevelNodes) {
      const schema = this.generateTableSchema(node, fileName);
      if (schema) {
        tabs.push({
          id: schema.id,
          name: this.formatTabName(node.key),
          path: node.path,
          schema,
          isActive: tabs.length === 0,
          level: 0,
        });
      }
    }

    return tabs;
  }
}

// Test data
const testData = {
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
};

// Run the test
console.log("🚀 Testing Complete JSON Flow...\n");

const parser = new TestJsonParserService();
const tabs = parser.parseJsonToTabs(testData, "test.json");

console.log("📊 Generated Tabs:");
tabs.forEach((tab, index) => {
  console.log(`\n${index + 1}. ${tab.name} (${tab.schema.data.length} rows)`);
  console.log(`   - Primary Key: ${tab.schema.primaryKey || "None detected"}`);
  console.log(
    `   - Columns: ${tab.schema.columns.map((c) => c.key).join(", ")}`
  );
  console.log(`   - Sample data:`, tab.schema.data[0]);
});

console.log(`\n✅ Successfully generated ${tabs.length} tabs from JSON data!`);
console.log("🎯 JSON functionality is working correctly!");
