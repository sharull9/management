"use client";

import {
  FilterBar,
  FilterDate,
  FilterSelect,
} from "@/components/shared/filter-bar/filter-bar";

export function ReportFilters({
  accounts,
  accountFilter = false,
}: {
  accounts: { id: string; code: string; name: string }[];
  accountFilter?: boolean;
}) {
  return (
    <FilterBar>
      <FilterDate name="from" label="From date" />
      <FilterDate name="to" label="To date" />
      {accountFilter && (
        <FilterSelect
          name="accountId"
          label="Account"
          options={accounts.map((account) => ({
            value: account.id,
            label: `${account.code} · ${account.name}`,
          }))}
        />
      )}
    </FilterBar>
  );
}
