"use client";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import type { ActionState } from "@/core/action-result";
import { deleteCityInput, saveCityInput } from "../../schema";
import {
  deleteCityAction,
  saveCityAction,
} from "../../server/location-actions";

/** Adds a client navigation to a successful result via ActionState.redirectTo. */
function withRedirect<T>(
  action: (input: T) => Promise<ActionState>,
  redirectTo: string,
) {
  return async (input: T) => {
    const result = await action(input);
    return result.error || result.fieldErrors
      ? result
      : { ...result, redirectTo };
  };
}

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
  const listHref = `/${org}/masters/locations`;
  const save = saveCityAction.bind(null, org);
  return (
    <>
      <ActionFormShell
        form={form}
        action={city ? save : withRedirect(save, listHref)}
        submit={city ? "Save changes" : "Create"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="name"
            label="City name"
            required
          />
          <ComboboxField
            control={form.control}
            name="stateId"
            label="State"
            options={states}
          />
        </div>
      </ActionFormShell>
      {city && <DeleteCityForm org={org} id={city.id} redirectTo={listHref} />}
    </>
  );
}

function DeleteCityForm({
  org,
  id,
  redirectTo,
}: {
  org: string;
  id: string;
  redirectTo: string;
}) {
  const form = useZodForm(deleteCityInput, { id });
  return (
    <ActionFormShell
      form={form}
      action={withRedirect(deleteCityAction.bind(null, org), redirectTo)}
      submit="Delete city"
      destructive
      className="mt-3"
    >
      {null}
    </ActionFormShell>
  );
}
