"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";

export type CityRow = {
  id: string;
  name: string;
  state: string;
  country: string;
};

const columns: ColumnDef<CityRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="City" />
    ),
  },
  {
    accessorKey: "state",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="State" />
    ),
  },
  {
    accessorKey: "country",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Country" />
    ),
  },
];

export function CitiesTable({
  org,
  cities,
}: {
  org: string;
  cities: CityRow[];
}) {
  return (
    <DataTable
      columns={columns}
      data={cities}
      getRowId={(city) => city.id}
      searchPlaceholder="Search cities…"
      rowHref={(city) => `/${org}/masters/locations/${city.id}`}
      emptyState={{
        title: "No cities yet.",
        description: "Add a city to use it on parties and addresses.",
      }}
    />
  );
}
