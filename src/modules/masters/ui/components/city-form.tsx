"use client";
import type { Option } from "@/components/shared/combobox";
import {
  ActionFormShell,
  SelectField,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { deleteCityInput, saveCityInput } from "../../schema";
import {
  deleteCityAction,
  saveCityAction,
} from "../../server/location-actions";
export function CityForm({
  org,
  states,
  city,
}: {
  org: string;
  states: Option[];
  city?: { id: string; name: string; stateId: string };
}) {
  const form = useZodForm(saveCityInput, {
    id: city?.id,
    name: city?.name ?? "",
    stateId: city?.stateId ?? null,
  });
  return (
    <ActionFormShell
      form={form}
      action={saveCityAction.bind(null, org)}
      submit={city ? "Save changes" : "Add city"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="City name"
          required
        />
        <SelectField
          control={form.control}
          name="stateId"
          label="State"
          options={states}
        />
      </div>
    </ActionFormShell>
  );
}
export function DeleteCityForm({ org, id }: { org: string; id: string }) {
  const form = useZodForm(deleteCityInput, { id });
  return (
    <ActionFormShell
      form={form}
      action={deleteCityAction.bind(null, org)}
      submit="Delete city"
      destructive
    >
      {null}
    </ActionFormShell>
  );
}
