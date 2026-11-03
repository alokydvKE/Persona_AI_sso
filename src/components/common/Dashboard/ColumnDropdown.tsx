import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Table } from '@tanstack/react-table'

interface Props<TData> {
  table: Table<TData>
}

const ColumnDropdown = <TData,>({ table }: Props<TData>) => {
  return (
    <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size={"sm"} variant="outline" className="ml-auto bg-white">
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter(
                (column) => column.getCanHide()
              )
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
  )
}

export default ColumnDropdown