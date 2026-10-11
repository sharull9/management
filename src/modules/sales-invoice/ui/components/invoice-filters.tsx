"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { invoiceFiltersInput } from "../../schema";
import {
  findInvoiceCustomers,
  findInvoiceProjects,
} from "../../server/picker-actions";
export function InvoiceFilters({
  org,
  filters,
  customers,
  projects,
}: {
  org: string;
  filters: Record<string, string | undefined>;
  customers: Option[];
  projects: Option[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = useZodForm(invoiceFiltersInput, {
    customerId: filters.customerId ?? null,
    projectId: filters.projectId ?? null,
    status:
      invoiceFiltersInput.shape.status.safeParse(filters.status).data ?? null,
    overdue: filters.overdue === "1",
  });
  const loadCustomers = useCallback(
    (query: string) => findInvoiceCustomers(org, "sales.view", query),
    [org],
  );
  const loadProjects = useCallback(
    (query: string) => findInvoiceProjects(org, "sales.view", query),
    [org],
  );
  async function apply(input: z.input<typeof invoiceFiltersInput>) {
    const values = invoiceFiltersInput.parse(input);
    const search = new URLSearchParams(searchParams.toString());
    if (values.customerId) search.set("customerId", values.customerId);
    else search.delete("customerId");
    if (values.projectId) search.set("projectId", values.projectId);
    else search.delete("projectId");
    if (values.status) search.set("status", values.status);
    else search.delete("status");
    if (values.overdue) search.set("overdue", "1");
    else search.delete("overdue");
    router.replace(`/${org}/sales/invoices?${search}`, { scroll: false });
    return {};
  }
  return (
    <ActionFormShell form={form} action={apply} submit="Apply">
      <div className="grid gap-4 sm:grid-cols-3">
        <ComboboxField
          control={form.control}
          name="customerId"
          label="Customer"
          options={customers}
          loadOptions={loadCustomers}
          clearable
          placeholder="All customers"
        />
        <ComboboxField
          control={form.control}
          name="projectId"
          label="Project"
          options={projects}
          loadOptions={loadProjects}
          clearable
          placeholder="All projects"
        />
        <ComboboxField
          control={form.control}
          name="status"
          label="Status"
          options={invoiceFiltersInput.shape.status
            .unwrap()
            .options.map((value) => ({
              value,
              label: value.replaceAll("_", " "),
            }))}
          clearable
          placeholder="All statuses"
        />
        <CheckboxField control={form.control} name="overdue" label="Overdue" />
      </div>
    </ActionFormShell>
  );
}
