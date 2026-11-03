import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileUploader } from "../../../../components/common/Chat/fileUploader";

const makeFile = (name: string, sizeBytes = 1024) =>
  new File(["x".repeat(sizeBytes)], name, { type: "application/pdf" });

describe("FileUploader", () => {
  it("renders the drop zone and supported formats", () => {
    render(<FileUploader files={[]} setFiles={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText("Drag & drop files here")).toBeInTheDocument();
    expect(screen.getByText(/Supports PDF, DOCX/i)).toBeInTheDocument();
  });

  it("disables the continue button with no files and shows the count", () => {
    render(<FileUploader files={[]} setFiles={vi.fn()} onSubmit={vi.fn()} />);
    const button = screen.getByRole("button", { name: /continue with 0 files/i });
    expect(button).toBeDisabled();
  });

  it("lists selected files with name and size and enables continue", () => {
    const files = [makeFile("report.pdf", 2048), makeFile("data.csv", 512)];
    render(<FileUploader files={files} setFiles={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText("Selected Files (2)")).toBeInTheDocument();
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with 2 files/i })).toBeEnabled();
  });

  it("uses the singular label for exactly one file", () => {
    render(<FileUploader files={[makeFile("one.pdf")]} setFiles={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /continue with 1 file$/i })).toBeInTheDocument();
  });

  it("submits the continue label and then disables the button", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FileUploader files={[makeFile("a.pdf")]} setFiles={vi.fn()} onSubmit={onSubmit} />);

    const button = screen.getByRole("button", { name: /continue with 1 file/i });
    await user.click(button);
    expect(onSubmit).toHaveBeenCalledWith("Continue with 1 File");
    expect(button).toBeDisabled();
  });

  it("accepts files dropped onto the drop zone", () => {
    // Drag-and-drop isn't supported by userEvent, so fireEvent is unavoidable.
    const setFiles = vi.fn();
    const { container } = render(
      <FileUploader files={[]} setFiles={setFiles} onSubmit={vi.fn()} />,
    );
    const zone = container.querySelector(".border-dashed") as HTMLElement;
    const file = makeFile("dropped.pdf");

    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });

    expect(setFiles).toHaveBeenCalled();
    const updater = setFiles.mock.calls.at(-1)![0] as (prev: File[]) => File[];
    expect(updater([])).toEqual([file]);
  });

  it("appends newly chosen files via setFiles", async () => {
    const setFiles = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <FileUploader files={[]} setFiles={setFiles} onSubmit={vi.fn()} />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("new.pdf");

    await user.upload(input, file);

    expect(setFiles).toHaveBeenCalled();
    // The updater appends the chosen file to the previous list.
    const updater = setFiles.mock.calls[0][0] as (prev: File[]) => File[];
    expect(updater([])).toEqual([file]);
  });
});
