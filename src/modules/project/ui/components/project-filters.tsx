"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { enumOptions } from "@/components/shared/form/enum-options";
import { SelectField } from "@/components/shared/form/select-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
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
  const router = useRouter();
  const searchParams = useSearchParams();
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
        const params = new URLSearchParams(searchParams.toString());
        if (input.search) params.set("search", input.search);
        else params.delete("search");
        if (input.status) params.set("status", input.status);
        else params.delete("status");
        router.replace(`/${org}/projects?${params}`, { scroll: false });
        return {};
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
