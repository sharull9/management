"use client";
import { useCallback } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  FilterBar,
  FilterMultiSelect,
  FilterSelect,
  FilterToggle,
} from "@/components/shared/filter-bar/filter-bar";
import { enumOptions } from "@/components/shared/form/enum-options";
import { statusTone } from "@/components/shared/status-badge-tone";
import { invoiceFiltersInput } from "../../schema";
import {
  findInvoiceCustomers,
  findInvoiceProjects,
} from "../../server/picker-actions";

const statuses = enumOptions(
  Object.fromEntries(
    invoiceFiltersInput.shape.status
      .unwrap()
      .options.map((value) => [value, value]),
  ),
).map((option) => ({ ...option, tone: statusTone(option.value) }));

export function InvoiceFilters({
  org,
  customers,
  projects,
}: {
  org: string;
  customers: Option[];
  projects: Option[];
}) {
  const loadCustomers = useCallback(
    (query: string) => findInvoiceCustomers(org, "sales.view", query),
    [org],
  );
  const loadProjects = useCallback(
    (query: string) => findInvoiceProjects(org, "sales.view", query),
    [org],
  );
  return (
    <FilterBar>
      <FilterMultiSelect
        name="customerId"
        label="Customer"
        options={customers}
        loadOptions={loadCustomers}
        queryKey={["customers", org, "invoice-filter"]}
      />
      <FilterSelect
        name="projectId"
        label="Project"
        options={projects}
        loadOptions={loadProjects}
      />
      <FilterMultiSelect name="status" label="Status" options={statuses} />
      <FilterToggle name="overdue" label="Overdue" />
    </FilterBar>
  );
}
