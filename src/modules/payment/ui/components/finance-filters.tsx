"use client";
import { useMemo } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  FilterBar,
  FilterDate,
  FilterMultiSelect,
  FilterSelect,
} from "@/components/shared/filter-bar/filter-bar";
import { findProjects } from "../../server/picker-actions";

type FinanceFilterField = {
  name: string;
  label: string;
  options: Option[];
  clearable?: boolean;
  fallback?: string;
  /** Allow picking several values (comma-separated URL param). */
  multiple?: boolean;
};

export function FinanceFilters({
  org,
  permission = "payment.view",
  projects,
  fields = [],
  dateRange = false,
}: {
  org: string;
  permission?: string;
  /** Initial project options; more load on search. */
  projects: { id: string; name: string }[];
  fields?: FinanceFilterField[];
  dateRange?: boolean;
}) {
  const loadProjects = useMemo(
    () => findProjects.bind(null, org, permission),
    [org, permission],
  );
  return (
    <FilterBar>
      {dateRange && <FilterDate name="dateFrom" label="From" />}
      {dateRange && <FilterDate name="dateTo" label="To" />}
      {fields.map(({ multiple, clearable, fallback, ...field }) =>
        multiple ? (
          <FilterMultiSelect key={field.name} {...field} />
        ) : (
          <FilterSelect
            key={field.name}
            clearable={clearable}
            fallback={fallback}
            {...field}
          />
        ),
      )}
      <FilterSelect
        name="projectId"
        label="Project"
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        loadOptions={loadProjects}
      />
    </FilterBar>
  );
}
