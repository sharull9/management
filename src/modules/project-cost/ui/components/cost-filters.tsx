"use client";
import { useMemo } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  FilterBar,
  FilterDate,
  FilterMultiSelect,
} from "@/components/shared/filter-bar/filter-bar";
import { enumOptions } from "@/components/shared/form/enum-options";
import { CostType } from "@/generated/prisma/enums";
import { findCostStages } from "../../server/picker-actions";

export function CostFilters({
  org,
  projectId,
  stages,
}: {
  org: string;
  projectId: string;
  stages: Option[];
}) {
  const loadStages = useMemo(
    () => findCostStages.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <FilterBar>
      <FilterMultiSelect
        name="costType"
        label="Type"
        options={enumOptions(CostType)}
      />
      <FilterMultiSelect
        name="stageId"
        label="Stage"
        options={stages}
        loadOptions={loadStages}
        queryKey={["cost-stages", org, projectId]}
      />
      <FilterDate name="from" label="From date" />
      <FilterDate name="to" label="To date" />
    </FilterBar>
  );
}
