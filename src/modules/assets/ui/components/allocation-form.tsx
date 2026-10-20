"use client";

import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { assetAllocationInput } from "../../schema";
import { saveAllocationAction } from "../../server/actions";

export function AllocationForm({
  org,
  assetId,
  projects,
  allocation,
}: {
  org: string;
  assetId: string;
  projects: { id: string; name: string; code: string }[];
  allocation?: z.input<typeof assetAllocationInput>;
}) {
  const form = useZodForm<
    z.input<typeof assetAllocationInput>,
    z.output<typeof assetAllocationInput>
  >(assetAllocationInput, {
    id: allocation?.id,
    assetId,
    projectId: allocation?.projectId ?? "",
    startDate: allocation?.startDate ?? "",
    endDate: allocation?.endDate ?? null,
  });
  return (
    <ActionFormShell
      form={form}
      action={saveAllocationAction.bind(null, org)}
      submit={allocation ? "Save allocation" : "Allocate asset"}
    >
      <ComboboxField
        control={form.control}
        name="projectId"
        label="Project"
        options={projects.map(({ id, name, code }) => ({
          value: id,
          label: `${name} (${code})`,
        }))}
        disabled={!!allocation}
      />
      <DateField control={form.control} name="startDate" label="Start date" />
      <DateField control={form.control} name="endDate" label="End date" />
    </ActionFormShell>
  );
}
