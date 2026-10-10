import { SelectField } from "@/components/shared/fields";
import type { FinanceData } from "../../server/queries";

export function ProjectFilter({
  projects,
  projectId,
}: {
  projects: FinanceData["projects"];
  projectId?: string;
}) {
  return (
    <form className="flex max-w-md items-end gap-3">
      <SelectField
        label="Project"
        name="projectId"
        defaultValue={projectId ?? ""}
      >
        <option value="">All accessible projects</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </SelectField>
      <button className="rounded-md border px-4 py-2 text-sm" type="submit">
        Filter
      </button>
    </form>
  );
}
