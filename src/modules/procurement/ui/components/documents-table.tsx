"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Decimal } from "@/core/decimal";
import type { PageInfo } from "@/core/pagination";

export type DocumentRow = {
  id: string;
  code: string;
  project: string;
  status: string;
  date: string;
  total: string | null;
  /** Document currency; empty for requests and transfers. */
  currency: string;
  /** Total in the organization base currency (orders only). */
  baseTotal: string | null;
  baseCurrency: string;
  destination: string;
  vendor: string;
  order: string;
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
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
  { accessorKey: "currency", header: "Currency" },
  {
    accessorKey: "baseTotal",
    sortingFn: (a, b) =>
      new Decimal(a.original.baseTotal ?? 0).cmp(b.original.baseTotal ?? 0),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Base total" />
    ),
    cell: ({ row }) =>
      row.original.baseTotal === null
        ? ""
        : `${new Decimal(row.original.baseTotal).toFixed(2)} ${row.original.baseCurrency}`,
  },
  { accessorKey: "destination", header: "Destination" },
];
const vendorColumn: ColumnDef<DocumentRow> = {
  accessorKey: "vendor",
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Vendor" />
  ),
};
const orderColumn: ColumnDef<DocumentRow> = {
  accessorKey: "order",
  header: "Purchase order",
};
function columnsFor(kind: string) {
  return columns
    .filter((column) => {
      const key = "accessorKey" in column ? column.accessorKey : "";
      if (key === "destination") return kind === "transfers";
      if (key === "total") return kind !== "receipts" && kind !== "transfers";
      if (key === "currency") return kind === "orders" || kind === "receipts";
      if (key === "baseTotal") return kind === "orders";
      return true;
    })
    .flatMap((column) =>
      "accessorKey" in column && column.accessorKey === "status"
        ? [
            ...(kind === "orders" ? [vendorColumn] : []),
            ...(kind === "receipts" ? [orderColumn] : []),
            column,
          ]
        : [column],
    );
}
export function DocumentsTable({
  data,
  kind,
  serverPage,
}: {
  data: DocumentRow[];
  kind: string;
  serverPage: PageInfo;
}) {
  return (
    <DataTable
      columns={columnsFor(kind)}
      data={data}
      serverPage={serverPage}
      getRowId={(r) => r.id}
      rowHref={(r) => r.href}
      searchPlaceholder="Search documents..."
      emptyState={{ title: "No documents yet." }}
    />
  );
}
