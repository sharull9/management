"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { Badge } from "@/components/ui/badge";
import { Decimal } from "@/core/decimal";

export type DocumentRow = {
  id: string;
  code: string;
  project: string;
  status: string;
  date: string;
  total: string | null;
  destination: string;
  href: string;
};
const columns: ColumnDef<DocumentRow>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
    ),
  },
  {
    accessorKey: "project",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Project" />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="secondary">
        {row.original.status.replaceAll("_", " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => row.original.date.slice(0, 10),
  },
  {
    accessorKey: "total",
    sortingFn: (a, b) =>
      new Decimal(a.original.total ?? 0).cmp(b.original.total ?? 0),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total" />
    ),
    cell: ({ row }) =>
      row.original.total === null
        ? ""
        : new Decimal(row.original.total).toFixed(2),
  },
  { accessorKey: "destination", header: "Destination" },
];
export function DocumentsTable({ data }: { data: DocumentRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      rowHref={(r) => r.href}
      searchPlaceholder="Search documents..."
      emptyState={{ title: "No documents yet." }}
    />
  );
}
