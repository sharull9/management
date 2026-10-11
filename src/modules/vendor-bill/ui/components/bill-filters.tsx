"use client";
import { useMemo } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  FilterBar,
  FilterMultiSelect,
  FilterToggle,
} from "@/components/shared/filter-bar/filter-bar";
import { enumOptions } from "@/components/shared/form/enum-options";
import { statusTone } from "@/components/shared/status-badge-tone";
import { billFilterInput } from "../../schema";
import { findBillVendors } from "../../server/picker-actions";

const statuses = enumOptions(
  Object.fromEntries(
    billFilterInput.shape.status
      .unwrap()
      .options.map((value) => [value, value]),
  ),
).map((option) => ({ ...option, tone: statusTone(option.value) }));

export function BillFilters({
  org,
  projects,
  vendors,
}: {
  org: string;
  projects: Option[];
  vendors: Option[];
}) {
  const loadVendors = useMemo(
    () => findBillVendors.bind(null, org, "bill.view"),
    [org],
  );
  return (
    <FilterBar>
      <FilterMultiSelect
        name="projectId"
        label="Project"
        options={projects}
        queryKey={["projects", org, "bill"]}
      />
      <FilterMultiSelect
        name="partyId"
        label="Vendor"
        options={vendors}
        loadOptions={loadVendors}
        queryKey={["vendors", org, "bill-filter"]}
      />
      <FilterMultiSelect name="status" label="Status" options={statuses} />
      <FilterToggle name="overdue" label="Overdue with balance" />
    </FilterBar>
  );
}
