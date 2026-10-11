"use client";
import { useMemo } from "react";
import { findProjects } from "../../server/picker-actions";
import { FinanceFilters } from "./finance-filters";
export function ProjectFilter({
  org,
  permission = "payment.view",
  projects,
  projectId,
}: {
  org: string;
  permission?: string;
  projects: { id: string; name: string }[];
  projectId?: string;
}) {
  const loadOptions = useMemo(
    () => findProjects.bind(null, org, permission),
    [org, permission],
  );
  return (
    <FinanceFilters
      fields={[
        {
          name: "projectId",
          label: "Project",
          value: projectId ?? null,
          options: projects.map((p) => ({ value: p.id, label: p.name })),
          loadOptions,
          clearable: true,
          placeholder: "All accessible projects",
        },
      ]}
    />
  );
}
