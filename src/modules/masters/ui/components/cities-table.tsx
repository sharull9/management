"use client";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { CityForm, DeleteCityForm } from "./city-form";

type CityRow = {
  id: string;
  name: string;
  stateId: string;
  state: { name: string; country: { code: string } };
};
type StateOption = { id: string; name: string; country: { code: string } };

export function CitiesTable({
  org,
  cities,
  states,
}: {
  org: string;
  cities: CityRow[];
  states: StateOption[];
}) {
  const columns: ColumnDef<CityRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="City" />
      ),
    },
    {
      id: "location",
      accessorFn: (city) => `${city.state.name} · ${city.state.country.code}`,
      header: "State / country",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const city = row.original;
        return (
          <details>
            <summary className="cursor-pointer text-sm">Edit city</summary>
            <div className="min-w-56 space-y-4 pt-4">
              <CityForm
                org={org}
                city={city}
                states={states.map((s) => ({
                  value: s.id,
                  label: `${s.country.code} � ${s.name}`,
                }))}
              />
              <DeleteCityForm org={org} id={city.id} />
            </div>
          </details>
        );
      },
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={cities}
      getRowId={(city) => city.id}
      searchPlaceholder="Search cities…"
      emptyState={{ title: "No cities yet." }}
    />
  );
}
