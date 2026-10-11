"use client";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { FormCard } from "@/components/shared/form-card";
import { taxAppliesToSchema, taxScopeSchema } from "../../schema";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";
export function TaxMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      {[null, ...d.components].map((c) => (
        <FormCard
          key={c?.id ?? "new-component"}
          title={c?.name ?? "Create tax component"}
        >
          <MasterForm
            org={org}
            kind="taxComponent"
            id={c?.id}
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
                <TextField
                  control={form.control}
                  label="Name"
                  name="name"
                  required
                />
                <TextField
                  control={form.control}
                  label="Code"
                  name="code"
                  required
                />
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
        </FormCard>
      ))}
      {[null, ...d.taxGroups].map((g) => (
        <FormCard
          key={g?.id ?? "new-group"}
          title={g?.name ?? "Create tax group"}
        >
          <MasterForm
            org={org}
            kind="taxGroup"
            id={g?.id}
            defaultValues={{
              name: g?.name ?? "",
              countryId: (g?.countryId ?? "") || null,
              scope: g?.scope ?? "ANY",
              componentIds:
                (g?.components.map((x) => x.componentId) ?? []) || [],
            }}
          >
            {(form) => (
              <>
                <TextField
                  control={form.control}
                  label="Name"
                  name="name"
                  required
                />
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
        </FormCard>
      ))}
    </>
  );
}
