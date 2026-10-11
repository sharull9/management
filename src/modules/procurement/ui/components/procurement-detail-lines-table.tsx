"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";

type LineRow = {
  id: string;
  name: string;
  description: string;
  qty: string;
  uom: string;
  rate: string;
  discount: string;
  amount: string;
  received: string;
  accepted: string;
  rejected: string;
  pending: string;
};
const columns: ColumnDef<LineRow>[] = [
  {
    accessorKey: "name",
    header: "Item variant",
    cell: ({ row }) => (
      <span title={row.original.description}>{row.original.name}</span>
    ),
  },
  { accessorKey: "qty", header: "Quantity" },
  { accessorKey: "uom", header: "UOM" },
  { accessorKey: "rate", header: "Rate" },
  { accessorKey: "discount", header: "Discount %" },
  { accessorKey: "amount", header: "Net / estimate" },
  { accessorKey: "received", header: "Received" },
  { accessorKey: "accepted", header: "Accepted" },
  { accessorKey: "rejected", header: "Rejected" },
  { accessorKey: "pending", header: "Pending" },
];
export function ProcurementDetailLinesTable({ lines }: { lines: LineRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={lines}
      pageSize={Math.max(lines.length, 10)}
      getRowId={(line) => line.id}
      emptyState={{ title: "No document lines." }}
    />
  );
}
