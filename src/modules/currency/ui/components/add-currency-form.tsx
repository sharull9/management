"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { addCurrencyInput } from "../../schema";
import { setTenantCurrencyAction } from "../../server/actions";

export type AvailableCurrency = { code: string; name: string; symbol: string };

/** Enables a currency from the global master for this tenant. */
export function AddCurrencyForm({
  org,
  available,
}: {
  org: string;
  available: AvailableCurrency[];
}) {
  const form = useZodForm(addCurrencyInput, { currencyCode: "" });
  const options = useMemo(
    () =>
      available.map((currency) => ({
        value: currency.code,
        label: `${currency.code} | ${currency.name}`,
        description: currency.symbol,
      })),
    [available],
  );
  const add = (input: z.output<typeof addCurrencyInput>) =>
    setTenantCurrencyAction(org, {
      currencyCode: input.currencyCode,
      enabled: true,
    });
  return (
    <ActionFormShell form={form} action={add} submit="Add currency">
      <ComboboxField
        control={form.control}
        name="currencyCode"
        label="Currency"
        options={options}
        placeholder="Choose a currency"
        searchPlaceholder="Search by code or name…"
        emptyText="No more currencies available."
      />
    </ActionFormShell>
  );
}
