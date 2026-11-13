"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { Decimal } from "@/core/decimal";
import type { PageInfo } from "@/core/pagination";

type AdjustmentRow = {
  id: string;
  project: string;
  item: string;
  date: string;
  qty: string;
  uom: string;
  value: string;
  reason: string;
  recordedBy: string;
};
export function StockAdjustmentTable({
  rows,
  page,
  baseCurrency,
}: {
  rows: AdjustmentRow[];
  page: PageInfo;
  baseCurrency: string;
}) {
  const columns: ColumnDef<AdjustmentRow>[] = [
    { accessorKey: "date", header: "Date" },
    { accessorKey: "project", header: "Project" },
    { accessorKey: "item", header: "Item variant" },
    {
      accessorKey: "qty",
      header: "Quantity change",
      cell: ({ row }) =>
        `${new Decimal(row.original.qty).gt(0) ? "+" : ""}${row.original.qty} ${row.original.uom}`,
    },
    {
      accessorKey: "value",
      header: `Value change (${baseCurrency})`,
      cell: ({ row }) => row.original.value,
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => (
        <span className="block max-w-sm whitespace-normal break-words">
          {row.original.reason}
        </span>
      ),
    },
    { accessorKey: "recordedBy", header: "Recorded by" },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      serverPage={page}
      getRowId={(row) => row.id}
      searchPlaceholder="Search adjustments..."
      emptyState={{ title: "No stock adjustments yet." }}
    />
  );
}
