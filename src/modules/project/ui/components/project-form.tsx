"use client";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { MaterialCostRecognitionField } from "@/components/shared/form/material-cost-recognition-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { ProjectStatus } from "@/generated/prisma/enums";
import { projectFormInput } from "../../schema";
import { saveProjectAction } from "../../server/actions";
import { findCustomers, findProjectMembers } from "../../server/picker-actions";
export function ProjectForm({
  org,
  project,
  currency,
  customers,
  users,
}: {
  org: string;
  project?: z.input<typeof projectFormInput>;
  currency: string;
  customers: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const form = useZodForm<
    z.input<typeof projectFormInput>,
    z.output<typeof projectFormInput>
  >(
    projectFormInput,
    project ?? {
      id: null,
      name: "",
      description: "",
      status: "PLANNED",
      budgetAmount: "0.00",
      currency,
      clientPartyId: null,
      managerUserId: null,
      startDate: "",
      endDate: "",
      customerName: "",
      customerLegalName: "",
      materialCostRecognition: "ON_CONSUMPTION",
      confirmCostRecognitionChange: false,
    },
  );
  const loadCustomers = useMemo(
    () => findCustomers.bind(null, org, project?.id ?? null),
    [org, project?.id],
  );
  const loadMembers = useMemo(
    () => findProjectMembers.bind(null, org, project?.id ?? null, "project"),
    [org, project?.id],
  );
  return (
    <ActionFormShell
      form={form}
      action={saveProjectAction.bind(null, org)}
      submit={project ? "Save project" : "Create project"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Project name"
          required
          maxLength={150}
        />
        <TextField
          control={form.control}
          name="description"
          label="Description"
        />
        <ComboboxField
          control={form.control}
          name="clientPartyId"
          label="Client"
          options={toOptions(customers)}
          loadOptions={loadCustomers}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="managerUserId"
          label="Manager"
          options={toOptions(users)}
          loadOptions={loadMembers}
          clearable
        />
        <ComboboxField
          control={form.control}
          name="status"
          label="Status"
          options={enumOptions(ProjectStatus)}
        />
        <TextField
          control={form.control}
          name="budgetAmount"
          label="Budget"
          inputMode="decimal"
          required
        />
        <TextField
          control={form.control}
          name="currency"
          label="Currency"
          maxLength={3}
          required
        />
        <DateField control={form.control} name="startDate" label="Start date" />
        <DateField control={form.control} name="endDate" label="End date" />
      </div>
      {project ? (
        <MaterialCostRecognitionField
          control={form.control}
          name="materialCostRecognition"
          existingProject
          confirmationName="confirmCostRecognitionChange"
        />
      ) : (
        <MaterialCostRecognitionField
          control={form.control}
          name="materialCostRecognition"
        />
      )}
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm">Create a customer</summary>
        <a className="text-sm underline" href={`/${org}/masters/parties`}>
          Manage customers and vendor details in Parties
        </a>
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="customerName"
            label="Customer display name"
          />
          <TextField
            control={form.control}
            name="customerLegalName"
            label="Customer legal name"
          />
        </div>
      </details>
    </ActionFormShell>
  );
}
