import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiFileUploadDialog } from "../../../../components/common/Chat/MultiFileUploadDialog";

const makeFile = (name: string, sizeBytes = 1024, type = "application/pdf") =>
  new File(["x".repeat(sizeBytes)], name, { type });

const fileInput = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

describe("MultiFileUploadDialog", () => {
  it("renders the drop zone when open", () => {
    render(<MultiFileUploadDialog open setOpen={vi.fn()} />);
    expect(screen.getByText("Upload files")).toBeInTheDocument();
    expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
  });

  it("lists added files with their size", async () => {
    const user = userEvent.setup();
    render(<MultiFileUploadDialog open setOpen={vi.fn()} />);
    await user.upload(fileInput(), makeFile("report.pdf", 2048));

    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText(/1 file ·/)).toBeInTheDocument();
  });

  it("removes a file from the list", async () => {
    const user = userEvent.setup();
    render(<MultiFileUploadDialog open setOpen={vi.fn()} />);
    await user.upload(fileInput(), makeFile("doc.pdf"));

    await user.click(screen.getByRole("button", { name: "Remove doc.pdf" }));
    expect(screen.queryByText("doc.pdf")).not.toBeInTheDocument();
  });

  it("filters out files larger than the size limit", async () => {
    const user = userEvent.setup();
    render(<MultiFileUploadDialog open setOpen={vi.fn()} maxSizeMb={1} />);
    await user.upload(fileInput(), [
      makeFile("small.pdf", 500),
      makeFile("huge.pdf", 2 * 1024 * 1024),
    ]);

    expect(screen.getByText("small.pdf")).toBeInTheDocument();
    expect(screen.queryByText("huge.pdf")).not.toBeInTheDocument();
  });

  it("accepts files dropped onto the drop zone", () => {
    render(<MultiFileUploadDialog open setOpen={vi.fn()} />);
    const zone = document.querySelector(".border-dashed") as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile("dropped.pdf")] } });
    expect(screen.getByText("dropped.pdf")).toBeInTheDocument();
  });

  it("uploads the files and closes the dialog", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const setOpen = vi.fn();
    const user = userEvent.setup();
    render(<MultiFileUploadDialog open setOpen={setOpen} onUpload={onUpload} />);
    const file = makeFile("a.pdf");
    await user.upload(fileInput(), file);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /upload 1/i }));

    expect(onUpload).toHaveBeenCalledWith([file]);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("clears the selected files", async () => {
    const user = userEvent.setup();
    render(<MultiFileUploadDialog open setOpen={vi.fn()} />);
    await user.upload(fileInput(), makeFile("a.pdf"));

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("a.pdf")).not.toBeInTheDocument();
  });
});
