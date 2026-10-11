"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { statusLabel } from "@/components/shared/status-badge-tone";

export type ItemListRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  type: string;
  uom: string;
  variants: number;
  active: boolean;
};

export function ItemsTable({
  org,
  items,
}: {
  org: string;
  items: ItemListRow[];
}) {
  const columns: ColumnDef<ItemListRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.code}</span>
      ),
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
      cell: ({ row }) => row.original.category || "—",
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => <span>{statusLabel(row.original.type)}</span>,
    },
    { accessorKey: "uom", header: "UOM" },
    {
      accessorKey: "variants",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Variants" />
      ),
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (row.original.active ? "Active" : "Inactive"),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={items}
      getRowId={(item) => item.id}
      searchPlaceholder="Search items…"
      rowHref={(item) => `/${org}/masters/items/${item.id}`}
      emptyState={{
        title: "No items yet.",
        description: "Create your first item to start tracking stock.",
      }}
    />
  );
}
