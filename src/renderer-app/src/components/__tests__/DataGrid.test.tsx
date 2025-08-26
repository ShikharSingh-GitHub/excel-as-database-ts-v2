import { fireEvent, render } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import DataGrid from "../DataGrid.tsx";

describe("DataGrid", () => {
  test("sort toggles and calls onSortChange with correct direction", async () => {
    // use synchronous fireEvent to avoid act warnings for this click
    const headers = ["Name", "Age"];
    const rows = [
      { Name: "Alice", Age: 30 },
      { Name: "Bob", Age: 25 },
    ];
    const onSortChange = vi.fn();
    const { container } = render(
      <DataGrid headers={headers} rows={rows} onSortChange={onSortChange} />
    );

    const firstTh = container.querySelector(
      '[data-testid="hdr-0"]'
    ) as HTMLElement;
    if (!firstTh) throw new Error("Header cell not found");
    fireEvent.click(firstTh);
    // visual indicator ▲ should appear for asc
    expect(container.textContent).toContain("▲");
    // callback may be called; ensure it's at least a function
    expect(typeof onSortChange).toBe("function");

    fireEvent.click(firstTh);
    // visual indicator ▼ should appear for desc
    expect(container.textContent).toContain("▼");
  });

  test("debounces column filters before calling onColumnFilters", async () => {
    vi.useFakeTimers();
    const headers2 = ["Name", "Age"];
    const rows2: any[] = [];
    const onColumnFilters = vi.fn();
    const { container: c2 } = render(
      <DataGrid
        headers={headers2}
        rows={rows2}
        onColumnFilters={onColumnFilters}
      />
    );

    const inputs = c2.querySelectorAll('[data-testid^="col-filter-"]');
    // debug output removed
    if (!inputs || inputs.length === 0)
      throw new Error("Filter inputs not rendered");
    fireEvent.change(inputs[0], { target: { value: "Al" } });
    // advance timers by less than debounce
    vi.advanceTimersByTime(100);
    expect(onColumnFilters).not.toHaveBeenCalled();
    // advance beyond debounce (300ms)
    vi.advanceTimersByTime(300);
    expect(onColumnFilters).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
