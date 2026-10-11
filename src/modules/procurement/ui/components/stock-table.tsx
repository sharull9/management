"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { Decimal } from "@/core/decimal";

export type StockRow = {
  id: string;
  project: string;
  name: string;
  qty: string;
  uom: string;
  avgCost: string;
  value: string;
};
const columns: ColumnDef<StockRow>[] = [
  {
    accessorKey: "project",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Project" />
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Item variant" />
    ),
  },
  {
    accessorKey: "qty",
    sortingFn: (a, b) => new Decimal(a.original.qty).cmp(b.original.qty),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Quantity" />
    ),
  },
  { accessorKey: "uom", header: "UOM" },
  {
    accessorKey: "avgCost",
    sortingFn: (a, b) =>
      new Decimal(a.original.avgCost).cmp(b.original.avgCost),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Average cost" />
    ),
    cell: ({ row }) => new Decimal(row.original.avgCost).toFixed(4),
  },
  {
    accessorKey: "value",
    sortingFn: (a, b) => new Decimal(a.original.value).cmp(b.original.value),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Value" />
    ),
    cell: ({ row }) => new Decimal(row.original.value).toFixed(2),
  },
];
export function StockTable({ data }: { data: StockRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search stock..."
      emptyState={{ title: "No stock movements yet." }}
    />
  );
}
