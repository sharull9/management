"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";

export type CategoryListRow = {
  id: string;
  name: string;
  parent: string;
  items: number;
};

export function CategoriesTable({
  org,
  categories,
}: {
  org: string;
  categories: CategoryListRow[];
}) {
  const columns: ColumnDef<CategoryListRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "parent",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Parent" />
      ),
      cell: ({ row }) => row.original.parent || "—",
    },
    {
      accessorKey: "items",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Items" />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={categories}
      getRowId={(category) => category.id}
      searchPlaceholder="Search categories…"
      rowHref={(category) => `/${org}/masters/categories/${category.id}`}
      emptyState={{
        title: "No categories yet.",
        description: "Create a category to group your items.",
      }}
    />
  );
}
