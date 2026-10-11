"use client";
import { useMemo } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  FilterBar,
  FilterMultiSelect,
  FilterSearch,
} from "@/components/shared/filter-bar/filter-bar";
import { enumOptions } from "@/components/shared/form/enum-options";
import { statusTone } from "@/components/shared/status-badge-tone";
import { TaskStatus } from "@/generated/prisma/enums";
import { findTaskStages } from "../../server/picker-actions";

export function TaskFilters({
  org,
  projectId,
  stages,
}: {
  org: string;
  projectId: string;
  stages: Option[];
}) {
  const loadStages = useMemo(
    () => findTaskStages.bind(null, org, projectId),
    [org, projectId],
  );
  return (
    <FilterBar>
      <FilterSearch placeholder="Search tasks…" />
      <FilterMultiSelect
        name="status"
        label="Status"
        options={enumOptions(TaskStatus).map((option) => ({
          ...option,
          tone: statusTone(option.value),
        }))}
      />
      <FilterMultiSelect
        name="stageId"
        label="Stage"
        options={stages}
        loadOptions={loadStages}
        queryKey={["task-stages", org, projectId]}
      />
    </FilterBar>
  );
}
