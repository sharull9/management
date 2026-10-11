"use client";
import { useMemo } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  FilterBar,
  FilterDate,
  FilterMultiSelect,
  FilterSearch,
} from "@/components/shared/filter-bar/filter-bar";
import { findWorkforceWorkers } from "../../server/picker-actions";

export function WorkerSearchFilter() {
  return (
    <FilterBar>
      <FilterSearch placeholder="Search workers…" />
    </FilterBar>
  );
}

export function AvailabilityFilters({
  org,
  workers,
}: {
  org: string;
  workers: Option[];
}) {
  const loadWorkers = useMemo(
    () => findWorkforceWorkers.bind(null, org),
    [org],
  );
  return (
    <FilterBar>
      <FilterMultiSelect
        name="workerId"
        label="Worker"
        options={workers}
        loadOptions={loadWorkers}
        queryKey={["workforce-workers", org]}
      />
      <FilterDate name="from" label="Available from" />
      <FilterDate name="to" label="Available to" />
    </FilterBar>
  );
}
