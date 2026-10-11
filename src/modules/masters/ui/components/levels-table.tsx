"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";

export type LevelListRow = {
  id: string;
  level: number;
  name: string;
  values: number;
  enabled: boolean;
};

export function LevelsTable({
  org,
  levels,
}: {
  org: string;
  levels: LevelListRow[];
}) {
  const columns: ColumnDef<LevelListRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "level",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Level" />
      ),
    },
    {
      accessorKey: "values",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Values" />
      ),
    },
    {
      accessorKey: "enabled",
      header: "Status",
      cell: ({ row }) => (row.original.enabled ? "Enabled" : "Disabled"),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={levels}
      getRowId={(level) => level.id}
      searchPlaceholder="Search levels…"
      rowHref={(level) => `/${org}/masters/levels/${level.id}`}
      emptyState={{
        title: "No item levels yet.",
        description: "Define up to five levels to describe item variants.",
      }}
    />
  );
}
