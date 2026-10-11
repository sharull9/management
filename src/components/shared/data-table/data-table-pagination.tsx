"use client";

import type { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

export function DataTablePagination<TData>({ table }: { table: Table<TData> }) {
  "use no memo";
  const count = table.getPageCount();
  return (
    <nav
      aria-label="Table pagination"
      className="flex items-center justify-between gap-4"
    >
      <p className="text-sm text-muted-foreground">
        Page {count ? table.getState().pagination.pageIndex + 1 : 0} of {count}{" "}
        · {table.getFilteredRowModel().rows.length} records
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
