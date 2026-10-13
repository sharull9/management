"use client";
import { useMemo } from "react";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions } from "@/components/shared/form/enum-options";
import { NumberField } from "@/components/shared/form/number-field";
import { TextField } from "@/components/shared/form/text-field";
import { findCurrencies } from "@/modules/currency/server/picker-actions";
import { partyTypeSchema } from "../../schema";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";

type PartyRow = Data["parties"][number];
/** Create (no `party`) or edit form for one party. */
export function PartyForm({ org, party }: { org: string; party?: PartyRow }) {
  const listHref = `/${org}/masters/parties`;
  const loadCurrencies = useMemo(() => findCurrencies.bind(null, org), [org]);
  return (
    <MasterForm
      org={org}
      kind="party"
      id={party?.id}
      afterCreate={listHref}
      afterDelete={listHref}
      defaultValues={{
        code: party?.code ?? "",
        legalName: party?.legalName ?? "",
        displayName: party?.displayName ?? "",
        type: party?.type ?? "BUSINESS",
        isVendor: party?.isVendor ?? false,
        isCustomer: party?.isCustomer ?? false,
        email: party?.email ?? "",
        phone: party?.phone ?? "",
        paymentTerms: party?.paymentTerms ?? 0,
        creditLimit: party?.creditLimit ?? "0",
        defaultCurrency: party?.defaultCurrency ?? null,
      }}
    >
      {(form) => (
        <>
          <TextField control={form.control} label="Code" name="code" required />
          <TextField
            control={form.control}
            label="Legal name"
            name="legalName"
            required
          />
          <TextField
            control={form.control}
            label="Display name"
            name="displayName"
            required
          />
          <ComboboxField
            control={form.control}
            label="Type"
            name="type"
            options={enumOptions(partyTypeSchema.enum)}
          />
          <CheckboxField
            control={form.control}
            label="Vendor"
            name="isVendor"
          />
          <CheckboxField
            control={form.control}
            label="Customer"
            name="isCustomer"
          />
          <TextField
            control={form.control}
            label="Email"
            name="email"
            type="email"
          />
          <TextField control={form.control} label="Phone" name="phone" />
          <NumberField
            control={form.control}
            label="Payment terms days"
            name="paymentTerms"
            min="0"
          />
          <TextField
            control={form.control}
            label="Credit limit"
            name="creditLimit"
            inputMode="decimal"
          />
          <ComboboxField
            control={form.control}
            label="Default currency"
            name="defaultCurrency"
            description="Pre-selected on new purchase orders, bills and invoices for this party."
            options={
              party?.defaultCurrency
                ? [
                    {
                      value: party.defaultCurrency,
                      label: party.defaultCurrency,
                    },
                  ]
                : []
            }
            loadOptions={loadCurrencies}
            queryKey={["currencies", org]}
            placeholder="Organization base currency"
            clearable
          />
        </>
      )}
    </MasterForm>
  );
}
