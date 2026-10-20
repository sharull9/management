"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { Decimal } from "@/core/decimal";
import type { PageInfo } from "@/core/pagination";

export type StockRow = {
  id: string;
  project: string;
  name: string;
  qty: string;
  uom: string;
  avgCost: string;
  value: string;
};
const columnsFor = (baseCurrency: string): ColumnDef<StockRow>[] => [
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
      <DataTableColumnHeader
        column={column}
        title={`Average cost (${baseCurrency})`}
      />
    ),
    cell: ({ row }) => new Decimal(row.original.avgCost).toFixed(4),
  },
  {
    accessorKey: "value",
    sortingFn: (a, b) => new Decimal(a.original.value).cmp(b.original.value),
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title={`Value (${baseCurrency})`}
      />
    ),
    cell: ({ row }) => new Decimal(row.original.value).toFixed(2),
  },
];
export function StockTable({
  data,
  baseCurrency,
  serverPage,
}: {
  data: StockRow[];
  /** Stock is valued in the organization base currency. */
  baseCurrency: string;
  serverPage: PageInfo;
}) {
  return (
    <DataTable
      columns={columnsFor(baseCurrency)}
      data={data}
      serverPage={serverPage}
      getRowId={(r) => r.id}
      searchPlaceholder="Search stock..."
      emptyState={{ title: "No stock movements yet." }}
    />
  );
}
