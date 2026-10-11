"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, type EmptyStateProps } from "../empty-state";
import { DataTablePagination } from "./data-table-pagination";

export type DataTableProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchPlaceholder?: string;
  pageSize?: number;
  getRowId?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  rowHref?: (row: TData) => string;
  emptyState?: EmptyStateProps;
  /** Controls shown beside the search box, typically a FilterBar. */
  toolbar?: ReactNode;
};

// TanStack v8 returns mutable functions. Keep this component outside React Compiler memoization.
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 10,
  getRowId,
  onRowClick,
  rowHref,
  emptyState = { title: "No records found." },
  toolbar,
}: DataTableProps<TData>) {
  "use no memo";
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {(searchPlaceholder || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchPlaceholder && (
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
              />
            </InputGroup>
          )}
          {toolbar}
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-9 text-xs font-medium text-muted-foreground"
                  colSpan={header.colSpan}
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={
                  onRowClick
                    ? (event) => {
                        if (
                          !(event.target instanceof Element) ||
                          !event.target.closest(
                            "a,button,input,select,textarea,summary,[role=button],[role=checkbox]",
                          )
                        )
                          onRowClick(row.original);
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell, index) => (
                  <TableCell key={cell.id}>
                    {index === 0 && rowHref ? (
                      <Link
                        href={rowHref(row.original)}
                        className="font-medium underline-offset-4 hover:text-primary hover:underline"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </Link>
                    ) : index === 0 && onRowClick ? (
                      <button
                        type="button"
                        className="cursor-pointer text-left font-medium underline-offset-4 hover:text-primary hover:underline"
                        onClick={() => onRowClick(row.original)}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </button>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <EmptyState {...emptyState} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <DataTablePagination table={table} />
    </div>
  );
}
