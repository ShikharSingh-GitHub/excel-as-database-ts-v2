// Test the enhanced createRow functionality
const fs = require("fs");
const path = require("path");

// Import the main functions
const { ipcMain } = require("electron");

// Mock the getJsonSchema function from main.js
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
          const columns = new Set();
          let isLeaf = true;

          objectItems.forEach((obj) => {
            Object.keys(obj).forEach((key) => columns.add(key));
          });

          for (const obj of objectItems.slice(0, 10)) {
            for (const key of columns) {
              const val = obj[key];
              if (val != null && typeof val === "object") {
                isLeaf = false;
                break;
              }
            }
            if (!isLeaf) break;
          }

          const pkCandidates = [
            "#",
            "id",
            "uuid",
            "ID",
            "key",
            "name",
            "_id",
            "rowId",
            "pk",
          ];
          let pkField = null;

          for (const candidate of pkCandidates) {
            if (columns.has(candidate)) {
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

          if (!pkField) {
            for (const col of Array.from(columns)) {
              const values = new Set();
              let isUnique = true;
              let hasValidValues = true;

              for (const obj of objectItems) {
                const val = obj[col];
                if (val == null || val === "" || val === 0) {
                  hasValidValues = false;
                  break;
                }
                if (values.has(val)) {
                  isUnique = false;
                  break;
                }
                values.add(val);
              }

              if (isUnique && hasValidValues) {
                pkField = col;
                console.log(
                  `Auto-detected PK field: ${col} for path: ${currentPath}`
                );
                break;
              }
            }
          }

          schema.byPath[currentPath] = {
            type: "arrayOfObjects",
            columns: Array.from(columns),
            isLeaf,
            pkField,
            allowCrud: !!pkField,
            itemCount: objectItems.length,
          };

          if (!isLeaf) {
            objectItems.slice(0, 5).forEach((obj, idx) => {
              Object.keys(obj).forEach((key) => {
                const val = obj[key];
                if (val != null && typeof val === "object") {
                  const nestedPath = `${currentPath}[${idx}].${key}`;
                  analyzeNode(val, nestedPath);
                }
              });
            });
          }
        }
      } else if (node && typeof node === "object" && !Array.isArray(node)) {
        Object.keys(node).forEach((key) => {
          const val = node[key];
          if (val != null && typeof val === "object") {
            const nestedPath = currentPath ? `${currentPath}.${key}` : key;
            analyzeNode(val, nestedPath);
          }
        });
      }
    }

    analyzeNode(data, "");
    return schema;
  } catch (e) {
    console.error("Schema analysis failed:", e);
    return { byPath: {} };
  }
}

function getAtPath(obj, path) {
  if (!path) return obj;
  const parts = path.split(/[\.\[\]]+/).filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[isNaN(Number(part)) ? part : Number(part)];
  }
  return current;
}

// Test the enhanced createRow logic
async function testCreateRow() {
  const filePath = "./test_nested_users.json";
  const tablePath = "users";
  const newRow = {};

  console.log("🧪 Testing enhanced createRow with real backend logic...");

  try {
    const abs = path.resolve(filePath);
    const schema = getJsonSchema(abs);

    console.log("📋 Schema:", JSON.stringify(schema, null, 2));

    const meta = schema.byPath[tablePath];
    console.log("📋 Table metadata:", meta);

    if (!meta?.allowCrud) {
      throw new Error("Read-only table");
    }

    const jsonData = JSON.parse(fs.readFileSync(abs, "utf8"));
    const arr = getAtPath(jsonData, tablePath);

    if (!Array.isArray(arr)) {
      throw new Error("Table path does not point to an array");
    }

    const pk = meta.pkField;
    let finalRow = { ...newRow };

    // Enhanced row creation logic
    if (arr.length > 0) {
      const sampleItem = arr[0];
      Object.keys(sampleItem).forEach((key) => {
        if (!(key in finalRow)) {
          const sampleValue = sampleItem[key];
          console.log(
            `\nProcessing field: ${key}, type: ${typeof sampleValue}`
          );

          if (typeof sampleValue === "string") {
            finalRow[key] = `New ${key}`;
          } else if (typeof sampleValue === "number") {
            finalRow[key] = 0;
          } else if (typeof sampleValue === "boolean") {
            finalRow[key] = false;
          } else if (Array.isArray(sampleValue)) {
            console.log(`  Array field ${key} has ${sampleValue.length} items`);
            if (
              sampleValue.length > 0 &&
              typeof sampleValue[0] === "object" &&
              !Array.isArray(sampleValue[0])
            ) {
              const templateObj = {};
              const allKeys = new Set();

              sampleValue.slice(0, 5).forEach((obj) => {
                if (obj && typeof obj === "object") {
                  Object.keys(obj).forEach((k) => allKeys.add(k));
                }
              });

              console.log(
                `  Found object keys in array: ${Array.from(allKeys).join(
                  ", "
                )}`
              );

              allKeys.forEach((k) => {
                const sampleVal = sampleValue.find(
                  (obj) => obj && obj[k] !== undefined
                )?.[k];
                if (typeof sampleVal === "string") templateObj[k] = "";
                else if (typeof sampleVal === "number") templateObj[k] = 0;
                else if (typeof sampleVal === "boolean") templateObj[k] = false;
                else if (Array.isArray(sampleVal)) templateObj[k] = [];
                else if (typeof sampleVal === "object" && sampleVal !== null)
                  templateObj[k] = {};
                else templateObj[k] = null;
              });

              finalRow[key] = [templateObj];
              console.log(
                `  ✅ Created array template for ${key}:`,
                templateObj
              );
            } else {
              finalRow[key] = [];
            }
          } else if (typeof sampleValue === "object" && sampleValue !== null) {
            console.log(
              `  Object field ${key} has keys: ${Object.keys(sampleValue).join(
                ", "
              )}`
            );
            const templateObj = {};
            const sampleKeys = Object.keys(sampleValue);

            const allSampleObjects = arr
              .slice(0, 5)
              .map((item) => item[key])
              .filter(
                (val) => val && typeof val === "object" && !Array.isArray(val)
              );
            const allKeys = new Set();

            allSampleObjects.forEach((obj) => {
              Object.keys(obj).forEach((k) => allKeys.add(k));
            });

            if (allKeys.size === 0) {
              sampleKeys.forEach((k) => allKeys.add(k));
            }

            console.log(
              `  Found object keys: ${Array.from(allKeys).join(", ")}`
            );

            allKeys.forEach((k) => {
              const sampleVal =
                allSampleObjects.find((obj) => obj[k] !== undefined)?.[k] ||
                sampleValue[k];
              if (typeof sampleVal === "string") templateObj[k] = "";
              else if (typeof sampleVal === "number") templateObj[k] = 0;
              else if (typeof sampleVal === "boolean") templateObj[k] = false;
              else if (Array.isArray(sampleVal)) {
                if (sampleVal.length > 0 && typeof sampleVal[0] === "object") {
                  const nestedTemplate = {};
                  Object.keys(sampleVal[0]).forEach((nk) => {
                    const nv = sampleVal[0][nk];
                    if (typeof nv === "string") nestedTemplate[nk] = "";
                    else if (typeof nv === "number") nestedTemplate[nk] = 0;
                    else if (typeof nv === "boolean")
                      nestedTemplate[nk] = false;
                    else nestedTemplate[nk] = null;
                  });
                  templateObj[k] = [nestedTemplate];
                } else {
                  templateObj[k] = [];
                }
              } else if (typeof sampleVal === "object" && sampleVal !== null) {
                templateObj[k] = {};
              } else {
                templateObj[k] = null;
              }
            });

            finalRow[key] = templateObj;
            console.log(
              `  ✅ Created object template for ${key}:`,
              templateObj
            );
          } else {
            finalRow[key] = null;
          }
        }
      });
    }

    // Auto-generate PK
    if (pk !== "#") {
      if (finalRow?.[pk] == null) {
        if (pk === "id") {
          const existingIds = arr
            .map((item) => item[pk])
            .filter((id) => typeof id === "number");
          const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
          finalRow[pk] = maxId + 1;
        } else {
          finalRow[pk] = `new-item-${Date.now()}`;
        }
      }
    }

    console.log("\n🎯 Final enhanced row to be created:");
    console.log(JSON.stringify(finalRow, null, 2));

    return {
      success: true,
      message: "Row template created successfully with nested headers",
      newRow: finalRow,
    };
  } catch (e) {
    console.error("❌ Failed to create row:", e);
    return { error: e.message };
  }
}

// Run the test
testCreateRow().then((result) => {
  console.log("\n✅ Test completed:", result);
});
