"use client";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { taxAppliesToSchema, taxScopeSchema } from "../../schema";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";

type ComponentRow = Data["components"][number];
type GroupRow = Data["taxGroups"][number];

/** Create (no `taxComponent`) or edit form for one tax component. */
export function TaxComponentForm({
  org,
  taxComponent: c,
}: {
  org: string;
  taxComponent?: ComponentRow;
}) {
  const listHref = `/${org}/masters/tax?tab=components`;
  return (
    <MasterForm
      org={org}
      kind="taxComponent"
      id={c?.id}
      afterCreate={listHref}
      afterDelete={listHref}
      defaultValues={{
        name: c?.name ?? "",
        code: c?.code ?? "",
        rate: c?.rate ?? "0",
        appliesTo: c?.appliesTo ?? "BOTH",
        isWithholding: c?.isWithholding ?? false,
      }}
    >
      {(form) => (
        <>
          <TextField control={form.control} label="Name" name="name" required />
          <TextField control={form.control} label="Code" name="code" required />
          <TextField
            control={form.control}
            label="Rate %"
            name="rate"
            required
          />
          <ComboboxField
            control={form.control}
            label="Applies to"
            name="appliesTo"
            options={enumOptions(taxAppliesToSchema.enum)}
          />
          <CheckboxField
            control={form.control}
            label="Withholding"
            name="isWithholding"
          />
        </>
      )}
    </MasterForm>
  );
}

/** Create (no `taxGroup`) or edit form for one tax group. */
export function TaxGroupForm({
  org,
  data: d,
  taxGroup: g,
}: {
  org: string;
  data: Data;
  taxGroup?: GroupRow;
}) {
  const listHref = `/${org}/masters/tax?tab=groups`;
  return (
    <MasterForm
      org={org}
      kind="taxGroup"
      id={g?.id}
      afterCreate={listHref}
      afterDelete={listHref}
      defaultValues={{
        name: g?.name ?? "",
        countryId: (g?.countryId ?? "") || null,
        scope: g?.scope ?? "ANY",
        componentIds: g?.components.map((x) => x.componentId) ?? [],
      }}
    >
      {(form) => (
        <>
          <TextField control={form.control} label="Name" name="name" required />
          <ComboboxField
            control={form.control}
            label="Country"
            name="countryId"
            options={toOptions(d.countries)}
            clearable
          />
          <ComboboxField
            control={form.control}
            label="Scope"
            name="scope"
            options={enumOptions(taxScopeSchema.enum)}
          />
          <ComboboxField
            multiple
            control={form.control}
            label="Components"
            name="componentIds"
            options={toOptions(d.components)}
          />
        </>
      )}
    </MasterForm>
  );
}
