"use client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney } from "@/core/format";
import { Decimal } from "../../server/allocation";

export type RequestRow = {
  id: string;
  code: string;
  date: string;
  party: string;
  project: string;
  documents: string;
  status: string;
  currency: string;
  amount: string;
};

export function RequestTable({
  org,
  toolbar,
  data,
}: {
  org: string;
  toolbar?: ReactNode;
  data: RequestRow[];
}) {
  const columns: ColumnDef<RequestRow>[] = [
    {
      accessorKey: "code",
      header: "Request no.",
      cell: ({ row }) => (
        <Link
          className="font-medium underline-offset-4 hover:underline"
          href={`/${org}/finance/payment-requests/${row.original.id}`}
        >
          {row.original.code}
        </Link>
      ),
    },
    { accessorKey: "party", header: "Party" },
    { accessorKey: "project", header: "Project" },
    {
      accessorKey: "documents",
      header: "Linked document",
      cell: ({ row }) => row.original.documents || "—",
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
      sortingFn: (a, b) =>
        new Decimal(a.original.amount).cmp(b.original.amount),
      cell: ({ row }) =>
        formatMoney(row.original.amount, row.original.currency),
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requested" />
      ),
      cell: ({ row }) => row.original.date.slice(0, 10),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={data}
      searchPlaceholder="Search requests, parties or projects..."
      getRowId={(r) => r.id}
      rowHref={(r) => `/${org}/finance/payment-requests/${r.id}`}
      emptyState={{ title: "No payment requests yet." }}
    />
  );
}
