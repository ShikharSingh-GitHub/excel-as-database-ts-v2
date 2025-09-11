/// <reference types="vitest" />
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";
import InlineEditableScalar from "../src/components/InlineEditableScalar";

describe("InlineEditableScalar", () => {
  test("renders non-editable as span", () => {
    render(<InlineEditableScalar value={"abc"} path={"a"} editable={false} />);
    expect(screen.getByText("abc")).toBeInTheDocument();
    expect(screen.getByText("abc").tagName.toLowerCase()).toBe("span");
  });

  test("allows editing when editable and calls onCommit", () => {
    const onCommit = vi.fn();
    render(
      <InlineEditableScalar
        value={"123"}
        path={"p"}
        editable={true}
        onCommit={onCommit}
      />
    );
    // click to enter edit mode
    fireEvent.click(screen.getByText("123"));
    const input = screen.getByDisplayValue("123") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    // change value
    fireEvent.change(input, { target: { value: "456" } });
    // press Enter to commit
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("p", "456");
  });
});
