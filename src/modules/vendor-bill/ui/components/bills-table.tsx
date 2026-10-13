"use client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Decimal } from "@/core/decimal";
import { formatMoney } from "@/core/format";

export type BillRow = {
  org: string;
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
  /** Grand total in the organization base currency. */
  baseGrandTotal: string;
  baseCurrency: string;
  status: string;
};
const columns: ColumnDef<BillRow>[] = [
  {
    accessorKey: "code",
    header: "Bill no.",
    cell: ({ row }) => (
      <Link
        className="font-medium underline-offset-4 hover:underline"
        href={`/${row.original.org}/procurement/bills/${row.original.id}`}
      >
        {row.original.code}
      </Link>
    ),
  },
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
      cell: ({ row }) => formatMoney(row.original[key], row.original.currency),
    }),
  ),
  { accessorKey: "currency", header: "Currency" },
  {
    accessorKey: "baseGrandTotal",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Base total" />
    ),
    sortingFn: (a, b) =>
      new Decimal(a.original.baseGrandTotal).cmp(b.original.baseGrandTotal),
    cell: ({ row }) =>
      formatMoney(row.original.baseGrandTotal, row.original.baseCurrency),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];
export function BillsTable({
  org,
  rows,
  toolbar,
}: {
  org: string;
  rows: BillRow[];
  toolbar?: ReactNode;
}) {
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      rowHref={(row) => `/${org}/procurement/bills/${row.id}`}
      searchPlaceholder="Search bills..."
      emptyState={{ title: "No bills match these filters." }}
    />
  );
}
