"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";

type OverviewRow = {
  id: string;
  label: string;
  value: string | number;
  href?: string;
};
export function OverviewTable({
  data,
  labelTitle,
  valueTitle,
}: {
  data: OverviewRow[];
  labelTitle: string;
  valueTitle: string;
}) {
  const columns: ColumnDef<OverviewRow>[] = [
    {
      accessorKey: "label",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={labelTitle} />
      ),
    },
    { accessorKey: "value", header: valueTitle },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      rowHref={
        data.some((row) => row.href) ? (row) => row.href ?? "#" : undefined
      }
      searchPlaceholder={`Search ${labelTitle.toLowerCase()}...`}
      emptyState={{ title: "No records found." }}
    />
  );
}
