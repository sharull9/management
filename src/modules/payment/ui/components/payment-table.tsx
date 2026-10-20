"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/core/format";
import type { PageInfo } from "@/core/pagination";
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
  serverPage,
}: {
  org: string;
  data: PaymentRow[];
  toolbar?: ReactNode;
  serverPage: PageInfo;
}) {
  const columns = useMemo<ColumnDef<PaymentRow>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Payment no." />
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
    [],
  );
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={data}
      serverPage={serverPage}
      searchPlaceholder="Search payments, parties or projects..."
      getRowId={(r) => r.id}
      rowHref={(r) => `/${org}/finance/payments/${r.id}`}
      emptyState={{ title: "No payments yet." }}
    />
  );
}
