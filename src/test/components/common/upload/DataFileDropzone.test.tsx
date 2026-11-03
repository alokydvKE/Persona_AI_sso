import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import DataFileDropzone from "@/components/common/Upload/DataFileDropzone";
import {
  MAX_DATA_FILES,
  type SelectedDataFile,
} from "@/hooks/useDataFileSelection";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const stage = (count: number): SelectedDataFile[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `f-${i}`,
    file: new File(["x".repeat(1024)], `wave_${i}.xlsx`),
  }));

const render = (items: SelectedDataFile[]) =>
  renderWithProviders(
    <DataFileDropzone
      items={items}
      onAddFiles={() => ({ added: 0 })}
      onRemove={vi.fn()}
    />,
  );

describe("DataFileDropzone", () => {
  it("lists every staged file with a way to remove it", () => {
    render(stage(3));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "Remove wave_0.xlsx" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 files/i)).toBeInTheDocument();
  });

  it("clips a full list instead of letting it overflow the card", () => {
    // The regression this guards: the height cap used to sit on the ScrollArea
    // ROOT, whose viewport is `size-full` — height:100% against a parent with no
    // definite height resolves to auto, so at 4-5 files the list grew straight
    // past the cap and rendered over the buttons below it.
    render(stage(MAX_DATA_FILES));

    const viewport = document.querySelector(
      "[data-slot=scroll-area-viewport]",
    ) as HTMLElement;
    expect(viewport).not.toBeNull();

    const root = viewport.closest("[data-slot=scroll-area]") as HTMLElement;
    // The cap targets the viewport (the element that actually scrolls) via a
    // child-scoped utility on the root, not the root's own max-height.
    expect(root.className).toContain(
      "[&>[data-slot=scroll-area-viewport]]:max-h-56",
    );
    expect(root.className).toContain("overflow-hidden");
    expect(root.className).not.toMatch(/(^|\s)max-h-/);
  });

  it("truncates a long filename rather than pushing the row apart", () => {
    const long = [
      {
        id: "f-long",
        file: new File(["x"], `${"survey-wave-".repeat(12)}.xlsx`),
      },
    ];
    render(long);

    const name = screen.getByTitle(long[0].file.name);
    expect(name.className).toContain("truncate");
    // The remove button must stay in the row, not be shoved out of it.
    expect(
      screen.getByRole("button", { name: `Remove ${long[0].file.name}` })
        .className,
    ).toContain("shrink-0");
  });

  it("renders nothing but the dropzone when no file is staged", () => {
    render([]);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(
      screen.getByText(/drop files here or click to browse/i),
    ).toBeInTheDocument();
  });
});
