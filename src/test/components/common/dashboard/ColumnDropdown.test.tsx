import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { renderWithProviders } from "@/test/test-utils";
import ColumnDropdown from "../../../../components/common/Dashboard/ColumnDropdown";

type Row = { name: string; type: string };
const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "type", header: "Type" },
];

function Harness() {
  const table = useReactTable({
    data: [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return <ColumnDropdown table={table} />;
}

describe("ColumnDropdown", () => {
  it("renders a Columns trigger", () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole("button", { name: "Columns" })).toBeInTheDocument();
  });

  it("lists toggleable columns in the menu", async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole("button", { name: "Columns" }));

    expect(await screen.findByRole("menuitemcheckbox", { name: "name" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: "type" })).toBeInTheDocument();
  });
});
