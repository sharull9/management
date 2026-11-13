"use client";

import { useCallback } from "react";
import { useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { adjustmentInput } from "../../adjustment-schema";
import {
  findAdjustmentVariants,
  recordStockAdjustmentAction,
} from "../../server/adjustment-actions";

export function StockAdjustmentForm({
  org,
  projects,
  baseCurrency,
}: {
  org: string;
  projects: { id: string; name: string }[];
  baseCurrency: string;
}) {
  const form = useZodForm<
    z.input<typeof adjustmentInput>,
    z.output<typeof adjustmentInput>
  >(adjustmentInput, {
    projectId: projects[0]?.id ?? "",
    itemVariantId: "",
    date: new Date().toISOString().slice(0, 10),
    direction: "DECREASE",
    qty: "",
    unitCost: "",
    reason: "",
  });
  const projectId = useWatch({ control: form.control, name: "projectId" });
  const direction = useWatch({ control: form.control, name: "direction" });
  const loadOptions = useCallback(
    (query: string) => findAdjustmentVariants(org, projectId, query),
    [org, projectId],
  );
  return (
    <ActionFormShell
      form={form}
      action={recordStockAdjustmentAction.bind(null, org)}
      submit="Record adjustment"
    >
      <ComboboxField
        control={form.control}
        name="projectId"
        label="Project"
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        clearable={false}
      />
      <ComboboxField
        control={form.control}
        name="itemVariantId"
        label="Item variant"
        options={[]}
        loadOptions={loadOptions}
        queryKey={["adjustment-variants", org, projectId]}
        disabled={!projectId}
        description="Choose an existing stock-tracked variant. Quantities use its stock unit."
      />
      <DateField control={form.control} name="date" label="Adjustment date" />
      <ComboboxField
        control={form.control}
        name="direction"
        label="Adjustment"
        clearable={false}
        options={[
          { value: "DECREASE", label: "Decrease stock" },
          { value: "INCREASE", label: "Increase stock" },
        ]}
      />
      <TextField
        control={form.control}
        name="qty"
        label="Quantity"
        inputMode="decimal"
        description="Enter a positive quantity in the item's stock unit."
      />
      {direction === "INCREASE" ? (
        <TextField
          control={form.control}
          name="unitCost"
          label={`Unit cost (${baseCurrency})`}
          inputMode="decimal"
          description="Base-currency cost per stock unit. Enter 0 for stock with no value."
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Stock removed is valued at its current moving average cost.
        </p>
      )}
      <TextField
        control={form.control}
        name="reason"
        label="Reason"
        maxLength={1000}
        description="Explain the count difference or correction. Recorded adjustments cannot be edited or deleted."
      />
    </ActionFormShell>
  );
}
