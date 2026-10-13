"use client";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { exchangeRateInput } from "../../schema";
import { saveExchangeRateAction } from "../../server/actions";

export type ExchangeRateFormValue = {
  id: string;
  currencyCode: string;
  /** `YYYY-MM-DD`. */
  rateDate: string;
  rate: string;
};

/** Create (no `rate`) or edit one dated exchange rate. */
export function ExchangeRateForm({
  org,
  baseCurrency,
  currencies,
  rate,
}: {
  org: string;
  baseCurrency: string;
  /** Enabled currencies other than the base currency. */
  currencies: Option[];
  rate?: ExchangeRateFormValue;
}) {
  const form = useZodForm(exchangeRateInput, {
    id: rate?.id ?? null,
    currencyCode: rate?.currencyCode ?? "",
    rateDate: rate?.rateDate ?? "",
    rate: rate?.rate ?? "",
  });
  return (
    <ActionFormShell
      form={form}
      action={saveExchangeRateAction.bind(null, org)}
      submit={rate ? "Save rate" : "Add rate"}
    >
      <ComboboxField
        control={form.control}
        name="currencyCode"
        label="Currency"
        description={`Rates are quoted in ${baseCurrency} per 1 unit of the currency.`}
        options={currencies}
        placeholder="Choose a currency"
        emptyText="Enable another currency first."
      />
      <DateField control={form.control} name="rateDate" label="Rate date" />
      <TextField
        control={form.control}
        name="rate"
        label={`Rate (${baseCurrency} per 1 unit)`}
        description="Greater than zero, up to 10 decimal places."
        inputMode="decimal"
        placeholder="83.5000000000"
      />
    </ActionFormShell>
  );
}
