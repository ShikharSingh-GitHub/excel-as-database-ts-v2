const fs = require("fs");

function getJsonSchema(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const schema = { byPath: {} };

    function analyzeNode(node, currentPath) {
      if (Array.isArray(node) && node.length > 0) {
        const objectItems = node.filter(
          (item) => item && typeof item === "object" && !Array.isArray(item)
        );

        if (objectItems.length === node.length && node.length > 0) {
          // Array of objects - analyze for CRUD capability
          const columns = new Set();
          let isLeaf = true;

          // Get union of all keys
          objectItems.forEach((obj) => {
            Object.keys(obj).forEach((key) => columns.add(key));
          });

          // Check if all values are scalar (leaf condition)
          for (const obj of objectItems.slice(0, 10)) {
            // Sample first 10
            for (const key of columns) {
              const val = obj[key];
              if (val != null && typeof val === "object") {
                isLeaf = false;
                break;
              }
            }
            if (!isLeaf) break;
          }

          // Detect primary key
          const pkCandidates = ["id", "uuid", "ID", "key", "name", "_id"];
          let pkField = null;

          for (const candidate of pkCandidates) {
            if (columns.has(candidate)) {
              // Check if values are unique and non-null
              const values = new Set();
              let isUnique = true;

              for (const obj of objectItems) {
                const val = obj[candidate];
                if (val == null || values.has(val)) {
                  isUnique = false;
                  break;
                }
                values.add(val);
              }

              if (isUnique) {
                pkField = candidate;
                break;
              }
            }
          }

          schema.byPath[currentPath] = {
            type: "arrayOfObjects",
            columns: Array.from(columns),
            isLeaf,
            pkField,
            allowCrud: isLeaf && pkField != null,
            itemCount: node.length,
          };
        }
      }

      if (node && typeof node === "object" && !Array.isArray(node)) {
        Object.keys(node).forEach((key) => {
          const childPath = currentPath ? `${currentPath}.${key}` : key;
          analyzeNode(node[key], childPath);
        });
      }
    }

    analyzeNode(data, "");
    return schema;
  } catch (error) {
    console.error("Schema analysis error:", error);
    return { byPath: {} };
  }
}

// Test with employees_crud.json
console.log("Testing schema analysis with employees_crud.json:");
const schema = getJsonSchema("./test_data/employees_crud.json");
console.log(JSON.stringify(schema, null, 2));
