"use client";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { orgInput } from "../../schema";
import { saveOrganizationAction } from "../../server/actions";
export type OrganizationFormData = Omit<z.input<typeof orgInput>, "id"> & {
  id: string;
};
type Location = { id: string; name: string };
export function OrganizationForm({
  tenantId,
  orgSlug = null,
  org,
  countries,
  states,
  cities = [],
}: {
  tenantId: string;
  orgSlug?: string | null;
  org?: OrganizationFormData;
  countries: (Location & { code: string })[];
  states: (Location & { countryId: string })[];
  cities?: Location[];
}) {
  const form = useZodForm(orgInput, {
    id: org?.id ?? null,
    tenantId,
    name: org?.name ?? "",
    slug: org?.slug ?? "",
    legalName: org?.legalName ?? "",
    baseCurrency: org?.baseCurrency ?? "INR",
    countryId: org?.countryId ?? null,
    stateId: org?.stateId ?? null,
    cityId: org?.cityId ?? null,
    postalCode: org?.postalCode ?? "",
    addressLine1: org?.addressLine1 ?? "",
    addressLine2: org?.addressLine2 ?? "",
  });
  return (
    <ActionFormShell
      form={form}
      action={saveOrganizationAction.bind(null, orgSlug)}
      submit={org ? "Save organization" : "Create organization"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Organization name"
          required
        />
        <TextField
          control={form.control}
          name="slug"
          label="URL slug"
          placeholder="acme-builders"
          required
        />
        <TextField control={form.control} name="legalName" label="Legal name" />
        <TextField
          control={form.control}
          name="baseCurrency"
          label="Base currency"
          maxLength={3}
          required
        />
        <ComboboxField
          control={form.control}
          name="countryId"
          label="Country"
          options={toOptions(countries)}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="stateId"
          label="State"
          options={states.map((s) => ({
            value: s.id,
            label: `${countries.find((c) => c.id === s.countryId)?.code ?? ""} \u00b7 ${s.name}`,
          }))}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="cityId"
          label="City"
          options={toOptions(cities)}
          clearable
        />
        <TextField
          control={form.control}
          name="postalCode"
          label="Postal code"
        />
        <TextField
          control={form.control}
          name="addressLine1"
          label="Address line 1"
        />
        <TextField
          control={form.control}
          name="addressLine2"
          label="Address line 2"
        />
      </div>
    </ActionFormShell>
  );
}
