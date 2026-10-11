"use client";
import { z } from "zod";
import {
  ActionFormShell,
  SelectField,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { enumOptions } from "@/components/shared/form/enum-options";
import { ProjectStatus } from "@/generated/prisma/enums";
import { projectFilterInput } from "../../schema";
export function ProjectFilters({
  org,
  search = "",
  status = null,
}: {
  org: string;
  search?: string;
  status?: string | null;
}) {
  const form = useZodForm<
    z.input<typeof projectFilterInput>,
    z.output<typeof projectFilterInput>
  >(projectFilterInput, {
    search,
    status: z.enum(ProjectStatus).safeParse(status).success
      ? (status as ProjectStatus)
      : null,
  });
  return (
    <ActionFormShell
      form={form}
      submit="Filter projects"
      className="grid items-end gap-4 sm:grid-cols-3"
      action={async (input) => {
        const params = new URLSearchParams();
        if (input.search) params.set("search", input.search);
        if (input.status) params.set("status", input.status);
        return { redirectTo: `/${org}/projects?${params}` };
      }}
    >
      <TextField control={form.control} name="search" label="Search" />
      <SelectField
        control={form.control}
        name="status"
        label="Status"
        options={enumOptions(ProjectStatus)}
        placeholder="All statuses"
        clearable
      />
    </ActionFormShell>
  );
}
