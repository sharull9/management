"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";

export type UomGroupListRow = {
  id: string;
  name: string;
  baseUnit: string;
  units: number;
  system: boolean;
};

export function UomGroupsTable({
  org,
  groups,
}: {
  org: string;
  groups: UomGroupListRow[];
}) {
  const columns: ColumnDef<UomGroupListRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "baseUnit",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Base unit" />
      ),
      cell: ({ row }) => row.original.baseUnit || "—",
    },
    {
      accessorKey: "units",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Units" />
      ),
    },
    {
      accessorKey: "system",
      header: "Source",
      cell: ({ row }) => (row.original.system ? "System" : "Custom"),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={groups}
      getRowId={(group) => group.id}
      searchPlaceholder="Search UOM groups…"
      rowHref={(group) => `/${org}/masters/uoms/${group.id}`}
      emptyState={{
        title: "No UOM groups yet.",
        description: "Create a group with its base unit to define units.",
      }}
    />
  );
}
