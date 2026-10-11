"use client";
import {
  FilterBar,
  FilterMultiSelect,
  FilterSearch,
} from "@/components/shared/filter-bar/filter-bar";
import { enumOptions } from "@/components/shared/form/enum-options";
import { statusTone } from "@/components/shared/status-badge-tone";
import { ProjectStatus } from "@/generated/prisma/enums";

export function ProjectFilters() {
  return (
    <FilterBar>
      <FilterSearch placeholder="Search name or code…" />
      <FilterMultiSelect
        name="status"
        label="Status"
        options={enumOptions(ProjectStatus).map((option) => ({
          ...option,
          tone: statusTone(option.value),
        }))}
      />
    </FilterBar>
  );
}
