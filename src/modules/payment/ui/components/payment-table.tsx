"use client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/core/format";
import { Decimal } from "../../server/allocation";

export type PaymentRow = {
  id: string;
  code: string;
  party: string;
  direction: string;
  project: string;
  date: string;
  mode: string;
  currency: string;
  amount: string;
  baseAmount: string;
  allocated: string;
  unallocated: string;
  status: string;
};

const amountColumn = (
  key: "amount" | "allocated" | "unallocated",
  title: string,
): ColumnDef<PaymentRow> => ({
  accessorKey: key,
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title={title} />
  ),
  sortingFn: (a, b) => new Decimal(a.original[key]).cmp(b.original[key]),
  cell: ({ row }) => formatMoney(row.original[key], row.original.currency),
});

export function PaymentTable({
  org,
  data,
  toolbar,
}: {
  org: string;
  data: PaymentRow[];
  toolbar?: ReactNode;
}) {
  const columns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment no." />
        ),
        cell: ({ row }) => (
          <Link
            className="font-medium underline-offset-4 hover:underline"
            href={`/${org}/finance/payments/${row.original.id}`}
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        accessorKey: "party",
        header: "Party",
        cell: ({ row }) => (
          <>
            {row.original.party}
            <p className="text-xs text-muted-foreground">
              {row.original.direction}
            </p>
          </>
        ),
      },
      { accessorKey: "project", header: "Project" },
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Date" />
        ),
        cell: ({ row }) => row.original.date.slice(0, 10),
      },
      { accessorKey: "mode", header: "Method" },
      { accessorKey: "currency", header: "Currency" },
      amountColumn("amount", "Amount"),
      {
        accessorKey: "baseAmount",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Base amount" />
        ),
        sortingFn: (a, b) =>
          new Decimal(a.original.baseAmount).cmp(b.original.baseAmount),
      },
      amountColumn("allocated", "Allocated"),
      amountColumn("unallocated", "Unallocated"),
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [org],
  );
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={data}
      searchPlaceholder="Search payments, parties or projects..."
      getRowId={(r) => r.id}
      rowHref={(r) => `/${org}/finance/payments/${r.id}`}
      emptyState={{ title: "No payments yet." }}
    />
  );
}
