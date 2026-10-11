"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { z } from "zod";
import { ComboboxField, type Option } from "@/components/shared/combobox";
import { useZodForm } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { billFilterInput } from "../../schema";
import { findBillVendors } from "../../server/picker-actions";

export function BillFilters({
  org,
  initial,
  projects,
  vendors,
}: {
  org: string;
  initial: z.input<typeof billFilterInput>;
  projects: Option[];
  vendors: Option[];
}) {
  const form = useZodForm(billFilterInput, initial);
  const router = useRouter();
  const loadVendors = useMemo(
    () => findBillVendors.bind(null, org, "bill.view"),
    [org],
  );
  return (
    <form
      className="grid gap-4 md:grid-cols-5"
      onSubmit={form.handleSubmit((values) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(values))
          if (value) search.set(key, value);
        router.push(`/${org}/procurement/bills?${search}`);
      })}
    >
      <ComboboxField
        control={form.control}
        name="projectId"
        label="Project"
        options={projects}
        clearable
        placeholder="All projects"
      />
      <ComboboxField
        control={form.control}
        name="partyId"
        label="Vendor"
        options={vendors}
        loadOptions={loadVendors}
        clearable
        placeholder="All vendors"
      />
      <ComboboxField
        control={form.control}
        name="status"
        label="Status"
        options={billFilterInput.shape.status.unwrap().options.map((value) => ({
          value,
          label: value.replaceAll("_", " "),
        }))}
        clearable
        placeholder="All statuses"
      />
      <ComboboxField
        control={form.control}
        name="overdue"
        label="Due"
        options={[{ value: "1", label: "Overdue with balance" }]}
        clearable
        placeholder="All bills"
      />
      <Button className="self-end" variant="outline" type="submit">
        Apply filters
      </Button>
    </form>
  );
}
