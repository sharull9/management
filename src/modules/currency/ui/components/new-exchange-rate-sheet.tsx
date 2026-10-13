"use client";
import type { Option } from "@/components/shared/combobox/combobox";
import { CreateSheet } from "@/components/shared/overlay/side-sheet";
import { ExchangeRateForm } from "./exchange-rate-form";

export function NewExchangeRateSheet({
  org,
  baseCurrency,
  currencies,
}: {
  org: string;
  baseCurrency: string;
  currencies: Option[];
}) {
  return (
    <CreateSheet
      label="Add rate"
      title="Add exchange rate"
      description="One rate per currency per date. Using an existing date updates that rate."
    >
      <ExchangeRateForm
        org={org}
        baseCurrency={baseCurrency}
        currencies={currencies}
      />
    </CreateSheet>
  );
}
