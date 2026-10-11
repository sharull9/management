"use client";
import { useMemo } from "react";
import { FormProvider, useFieldArray, useFormContext } from "react-hook-form";
import type { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { EmptyState } from "@/components/shared/empty-state";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { allocationActionInput } from "../../schema";
import { allocatePaymentAction } from "../../server/actions";
import { findOpenDocuments } from "../../server/picker-actions";
import type { Document } from "../../type";
export function AllocationFields({
  documents,
  loadOptions,
  selectedOptions = [],
}: {
  documents: Document[];
  loadOptions: (query: string) => Promise<Option[]>;
  selectedOptions?: Option[];
}) {
  const { control, formState } = useFormContext<{
    allocations: { documentId: string; amount: string }[];
  }>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "allocations",
  });
  return (
    <div className="space-y-3">
      {documents.length === 0 && (
        <EmptyState title="No open approved documents for this selection." />
      )}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <ComboboxField
            control={control}
            name={`allocations.${index}.documentId`}
            label="Open document"
            options={[
              ...selectedOptions,
              ...documents.map((d) => ({
                value: d.id,
                label: d.code,
                description: `${d.currency} ${d.outstanding} outstanding`,
              })),
            ].filter(
              (option, index, options) =>
                options.findIndex(
                  (candidate) => candidate.value === option.value,
                ) === index,
            )}
            loadOptions={loadOptions}
          />
          <TextField
            control={control}
            name={`allocations.${index}.amount`}
            label="Allocation amount"
            inputMode="decimal"
          />
          <Button type="button" variant="outline" onClick={() => remove(index)}>
            Remove
          </Button>
        </div>
      ))}
      <FieldError
        errors={[
          formState.errors.allocations,
          formState.errors.allocations?.root,
        ]}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => append({ documentId: "", amount: "" })}
      >
        Add allocation
      </Button>
      <Button type="button" variant="ghost" onClick={() => remove()}>
        Clear allocations
      </Button>
    </div>
  );
}
export function AllocationForm({
  org,
  paymentId,
  documents,
  direction,
  partyId,
  projectId,
  currency,
}: {
  org: string;
  paymentId: string;
  documents: Document[];
  direction: string;
  partyId: string;
  projectId: string | null;
  currency: string;
}) {
  const form = useZodForm<
    z.input<typeof allocationActionInput>,
    z.output<typeof allocationActionInput>
  >(allocationActionInput, {
    id: paymentId,
    allocations: [],
  });
  const loadOptions = useMemo(
    () =>
      findOpenDocuments.bind(
        null,
        org,
        "payment.record",
        direction,
        partyId,
        projectId,
        currency,
      ),
    [org, direction, partyId, projectId, currency],
  );
  return (
    <FormProvider {...form}>
      <ActionFormShell
        form={form}
        action={allocatePaymentAction.bind(null, org)}
        submit="Allocate payment"
      >
        <AllocationFields documents={documents} loadOptions={loadOptions} />
      </ActionFormShell>
    </FormProvider>
  );
}
