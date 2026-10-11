"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { ActionForm } from "@/components/shared/action-form";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { Field, SelectField } from "@/components/shared/fields";
import {
  deleteCityAction,
  saveCityAction,
} from "../../server/location-actions";

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
              <ActionForm action={saveCityAction.bind(null, org)}>
                <input type="hidden" name="id" value={city.id} />
                <Field
                  label="City name"
                  name="name"
                  defaultValue={city.name}
                  required
                />
                <SelectField
                  label="State"
                  name="stateId"
                  defaultValue={city.stateId}
                >
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.country.code} · {s.name}
                    </option>
                  ))}
                </SelectField>
              </ActionForm>
              <ActionForm
                action={deleteCityAction.bind(null, org)}
                submit="Delete city"
                destructive
              >
                <input type="hidden" name="id" value={city.id} />
              </ActionForm>
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
