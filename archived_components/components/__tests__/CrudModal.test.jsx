import { fireEvent, render, screen } from "@testing-library/react";
import CrudModal from "../CrudModal";

describe("CrudModal Component", () => {
  const headers = ["Name", "Age", "Email"];
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockOnChange = jest.fn();

  it("renders correctly when open", () => {
    render(
      <CrudModal
        open={true}
        title="Add Row"
        headers={headers}
        data={{}}
        errors={{}}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("Add Row")).toBeInTheDocument();
    headers.forEach((header) => {
      expect(screen.getByLabelText(header)).toBeInTheDocument();
    });
  });

  it("does not render when not open", () => {
    const { container } = render(
      <CrudModal
        open={false}
        title="Add Row"
        headers={headers}
        data={{}}
        errors={{}}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onChange={mockOnChange}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls onClose when the close button is clicked", () => {
    render(
      <CrudModal
        open={true}
        title="Add Row"
        headers={headers}
        data={{}}
        errors={{}}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByLabelText("Close modal"));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onSubmit when the submit button is clicked", () => {
    render(
      <CrudModal
        open={true}
        title="Add Row"
        headers={headers}
        data={{ Name: "John", Age: "30", Email: "john@example.com" }}
        errors={{}}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByLabelText("Submit form"));
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it("displays validation errors", () => {
    render(
      <CrudModal
        open={true}
        title="Add Row"
        headers={headers}
        data={{}}
        errors={{ Name: "Name is required" }}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });
});
