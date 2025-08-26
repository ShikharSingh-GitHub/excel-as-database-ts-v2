import { fireEvent, render, screen } from "@testing-library/react";
import Toast from "../Toast";

describe("Toast Component", () => {
  const mockOnClose = jest.fn();

  it("renders correctly with a success message", () => {
    render(
      <Toast
        message="Action completed successfully!"
        type="success"
        onClose={mockOnClose}
      />
    );

    expect(
      screen.getByText("Action completed successfully!")
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("bg-green-500");
  });

  it("renders correctly with an error message", () => {
    render(
      <Toast message="An error occurred." type="error" onClose={mockOnClose} />
    );

    expect(screen.getByText("An error occurred.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("bg-red-500");
  });

  it("calls onClose when the close button is clicked", () => {
    render(
      <Toast
        message="Action completed successfully!"
        type="success"
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByLabelText("Close notification"));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
