import React, { useMemo } from "react";
import AutoTable from "./AutoTable";

interface JsonDataViewerProps {
  data: any;
  fileName?: string;
}

export default function JsonDataViewer({
  data,
  fileName,
}: JsonDataViewerProps) {
  const tables = useMemo(() => {
    if (!data) return [];

    const tables: Array<{ title: string; data: any[] }> = [];

    // Handle different JSON structures
    if (Array.isArray(data)) {
      // If it's already an array, show it directly
      tables.push({
        title: fileName || "Data",
        data: data,
      });
    } else if (typeof data === "object" && data !== null) {
      // Look for common array patterns in the object
      const commonArrayKeys = [
        "pageConfig",
        "testsets",
        "testCases",
        "steps",
        "pageElements",
        "application",
        "data",
        "items",
        "results",
        "records",
      ];

      // First, try to find arrays with common names
      for (const key of commonArrayKeys) {
        if (Array.isArray(data[key])) {
          tables.push({
            title: key,
            data: data[key],
          });
        }
      }

      // If we found arrays in nested objects, look deeper
      if (data.data && typeof data.data === "object") {
        for (const key of commonArrayKeys) {
          if (Array.isArray(data.data[key])) {
            tables.push({
              title: `data.${key}`,
              data: data.data[key],
            });
          }
        }
      }

      // If no arrays found, show the object as a single-row table
      if (tables.length === 0) {
        tables.push({
          title: fileName || "Data",
          data: [data],
        });
      }
    }

    return tables;
  }, [data, fileName]);

  if (!data) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8">
      {tables.map((table, index) => (
        <AutoTable
          key={index}
          title={table.title}
          data={table.data}
          maxColumns={50}
        />
      ))}
    </div>
  );
}
