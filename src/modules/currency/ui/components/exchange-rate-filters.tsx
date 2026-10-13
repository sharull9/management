"use client";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  FilterBar,
  FilterDate,
  FilterSelect,
} from "@/components/shared/filter-bar/filter-bar";

export function ExchangeRateFilters({ currencies }: { currencies: Option[] }) {
  return (
    <FilterBar>
      <FilterSelect name="currency" label="Currency" options={currencies} />
      <FilterDate name="from" label="From date" />
      <FilterDate name="to" label="To date" />
    </FilterBar>
  );
}
