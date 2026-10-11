"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { Decimal } from "@/core/decimal";

export type ConsumptionRow = {
  id: string;
  code: string;
  project: string;
  date: string;
  stage: string;
  task: string;
  item: string;
  qty: string;
  uom: string;
  value: string;
};
const columns: ColumnDef<ConsumptionRow>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Number" />
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
  { accessorKey: "stage", header: "Stage" },
  { accessorKey: "task", header: "Task" },
  { accessorKey: "item", header: "Item variant" },
  {
    accessorKey: "qty",
    sortingFn: (a, b) => new Decimal(a.original.qty).cmp(b.original.qty),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Quantity" />
    ),
  },
  { accessorKey: "uom", header: "UOM" },
  {
    accessorKey: "value",
    sortingFn: (a, b) => new Decimal(a.original.value).cmp(b.original.value),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stock value" />
    ),
    cell: ({ row }) => new Decimal(row.original.value).toFixed(2),
  },
];
export function ConsumptionTable({ data }: { data: ConsumptionRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search consumption..."
      emptyState={{ title: "No consumption yet." }}
    />
  );
}
