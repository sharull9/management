"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { Decimal } from "@/core/decimal";
import { formatMoney } from "@/core/format";
export type InvoiceRow = {
  id: string;
  code: string;
  customer: string;
  project: string;
  date: string;
  dueDate: string | null;
  currency: string;
  grandTotal: string;
  receivedTotal: string;
  balance: string;
  status: string;
};
const columns: ColumnDef<InvoiceRow>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "customer", header: "Customer" },
  { accessorKey: "project", header: "Project" },
  ...(["date", "dueDate"] as const).map(
    (key): ColumnDef<InvoiceRow> => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={key === "date" ? "Date" : "Due"}
        />
      ),
      cell: ({ row }) => row.original[key] ?? "Unspecified",
    }),
  ),
  ...(["grandTotal", "receivedTotal", "balance"] as const).map(
    (key): ColumnDef<InvoiceRow> => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={
            {
              grandTotal: "Grand total",
              receivedTotal: "Received",
              balance: "Balance",
            }[key]
          }
        />
      ),
      sortingFn: (a, b) => new Decimal(a.original[key]).cmp(b.original[key]),
      cell: ({ row }) => formatMoney(row.original[key], row.original.currency),
    }),
  ),
  { accessorKey: "status", header: "Status" },
];
export function InvoicesTable({
  toolbar,
  org,
  rows,
}: {
  toolbar?: ReactNode;
  org: string;
  rows: InvoiceRow[];
}) {
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={rows}
      searchPlaceholder="Search invoices..."
      getRowId={(row) => row.id}
      rowHref={(row) => `/${org}/sales/invoices/${row.id}`}
      emptyState={{ title: "No invoices match these filters." }}
    />
  );
}
