"use client";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { Badge } from "@/components/ui/badge";
import { Decimal } from "@/core/decimal";

export type BillRow = {
  id: string;
  code: string;
  vendorInvoiceNo: string;
  vendor: string;
  project: string;
  date: string;
  dueDate: string;
  grandTotal: string;
  paidTotal: string;
  balance: string;
  currency: string;
  status: string;
};
const columns: ColumnDef<BillRow>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "vendorInvoiceNo", header: "Vendor invoice" },
  { accessorKey: "vendor", header: "Vendor" },
  { accessorKey: "project", header: "Project" },
  ...(
    [
      ["date", "Date"],
      ["dueDate", "Due"],
    ] as const
  ).map(
    ([key, title]): ColumnDef<BillRow> => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={title} />
      ),
    }),
  ),
  ...(
    [
      ["grandTotal", "Grand total"],
      ["paidTotal", "Paid"],
      ["balance", "Balance"],
    ] as const
  ).map(
    ([key, title]): ColumnDef<BillRow> => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={title} />
      ),
      sortingFn: (a, b) => new Decimal(a.original[key]).cmp(b.original[key]),
      cell: ({ row }) => `${row.original[key]} ${row.original.currency}`,
    }),
  ),
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant="secondary">
        {row.original.status.replaceAll("_", " ")}
      </Badge>
    ),
  },
];
export function BillsTable({ org, rows }: { org: string; rows: BillRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      rowHref={(row) => `/${org}/procurement/bills/${row.id}`}
      searchPlaceholder="Search bills..."
      emptyState={{ title: "No bills match these filters." }}
    />
  );
}
