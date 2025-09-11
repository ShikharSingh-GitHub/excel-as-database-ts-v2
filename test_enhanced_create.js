const fs = require("fs");

// Test the enhanced createRow logic by simulating the enhanced row creation
const testData = {
  users: [
    {
      id: 1,
      name: "John",
      profile: {
        age: 30,
        email: "john@test.com",
        preferences: {
          theme: "dark",
          notifications: true,
        },
      },
      orders: [
        { orderId: "A1", amount: 100, items: ["item1", "item2"] },
        { orderId: "A2", amount: 200, items: ["item3"] },
      ],
    },
    {
      id: 2,
      name: "Jane",
      profile: {
        age: 25,
        email: "jane@test.com",
        preferences: {
          theme: "light",
          notifications: false,
        },
      },
      orders: [{ orderId: "B1", amount: 150, items: ["item4", "item5"] }],
    },
  ],
};

const arr = testData.users;
const newRow = {}; // Empty row to be filled with templates

console.log("🧪 Testing enhanced row creation logic...");
console.log("📊 Existing array length:", arr.length);

if (arr.length > 0) {
  const sampleItem = arr[0];
  console.log("📋 Sample item keys:", Object.keys(sampleItem));

  Object.keys(sampleItem).forEach((key) => {
    if (!(key in newRow)) {
      const sampleValue = sampleItem[key];
      console.log(`\nProcessing field: ${key}, type: ${typeof sampleValue}`);

      if (typeof sampleValue === "string") {
        newRow[key] = `New ${key}`;
      } else if (typeof sampleValue === "number") {
        newRow[key] = 0;
      } else if (typeof sampleValue === "boolean") {
        newRow[key] = false;
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
            `  Found object keys in array: ${Array.from(allKeys).join(", ")}`
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

          newRow[key] = [templateObj];
          console.log(`  ✅ Created array template for ${key}:`, templateObj);
        } else {
          newRow[key] = [];
          console.log(`  ✅ Created empty array for ${key}`);
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

        console.log(`  Found object keys: ${Array.from(allKeys).join(", ")}`);

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
                else if (typeof nv === "boolean") nestedTemplate[nk] = false;
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

        newRow[key] = templateObj;
        console.log(`  ✅ Created object template for ${key}:`, templateObj);
      } else {
        newRow[key] = null;
      }
    }
  });
}

console.log("\n🎯 Final enhanced row template:");
console.log(JSON.stringify(newRow, null, 2));
