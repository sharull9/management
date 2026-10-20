"use client";

import { useFieldArray, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { TextareaField } from "@/components/shared/form/textarea-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { FieldSet } from "@/components/ui/field";
import { journalInput } from "../../schema";
import { saveJournalAction } from "../../server/actions";
import {
  formatDecimalString,
  sumDecimalStrings,
  todayUtcDate,
} from "./form-helpers";

type Journal = z.input<typeof journalInput>;
type Choice = { id: string; code: string; name: string };
type NamedChoice = { id: string; name: string };

export function JournalForm({
  org,
  baseCurrency,
  accounts,
  projects,
  parties,
  journal,
}: {
  org: string;
  baseCurrency: string;
  accounts: Choice[];
  projects: NamedChoice[];
  parties: NamedChoice[];
  journal?: Journal;
}) {
  const form = useZodForm<Journal, Journal>(journalInput, {
    id: journal?.id,
    date: journal?.date ?? todayUtcDate(),
    description: journal?.description ?? "",
    lines: journal?.lines?.length ? journal.lines : [emptyLine(), emptyLine()],
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const lines = useWatch({ control: form.control, name: "lines" });
  const debit = sumDecimalStrings(
    (lines ?? []).map((line) => line?.debit ?? "0"),
  );
  const credit = sumDecimalStrings(
    (lines ?? []).map((line) => line?.credit ?? "0"),
  );
  const options = accounts.map((item) => ({
    value: item.id,
    label: `${item.code} · ${item.name}`,
  }));
  const action = saveJournalAction.bind(null, org);

  return (
    <ActionFormShell
      form={form}
      action={action}
      submit={journal ? "Save journal" : "Create journal"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField control={form.control} name="date" label="Journal date" />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          required
          maxLength={500}
        />
      </div>
      <section aria-labelledby="journal-lines-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="journal-lines-heading" className="text-sm font-semibold">
            Journal lines
          </h2>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Debits {formatDecimalString(debit)} {baseCurrency} · Credits{" "}
            {formatDecimalString(credit)} {baseCurrency}
          </p>
        </div>
        <div className="space-y-4">
          {fields.map((field, index) => (
            <FieldSet
              key={field.id}
              className="min-w-0 rounded-lg border p-3 sm:p-4"
            >
              <legend className="px-1 text-sm font-medium">
                Line {index + 1}
              </legend>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ComboboxField
                  control={form.control}
                  name={`lines.${index}.accountId`}
                  placeholder="Choose an account"
                  label="Account"
                  options={options}
                />
                <TextField
                  control={form.control}
                  name={`lines.${index}.description`}
                  label="Line description"
                  maxLength={500}
                />
                <TextField
                  control={form.control}
                  name={`lines.${index}.debit`}
                  label={`Debit (${baseCurrency})`}
                  inputMode="decimal"
                />
                <TextField
                  control={form.control}
                  name={`lines.${index}.credit`}
                  label={`Credit (${baseCurrency})`}
                  inputMode="decimal"
                />
                <ComboboxField
                  control={form.control}
                  name={`lines.${index}.projectId`}
                  label="Project (optional)"
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  clearable
                />
                <ComboboxField
                  control={form.control}
                  name={`lines.${index}.partyId`}
                  label="Party (optional)"
                  options={parties.map((p) => ({ value: p.id, label: p.name }))}
                  clearable
                />
              </div>
              {fields.length > 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove line ${index + 1}`}
                >
                  Remove line
                </Button>
              )}
            </FieldSet>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => append(emptyLine())}
          >
            Add line
          </Button>
          <p
            className={
              debit.equals(credit) && !debit.isZero()
                ? "text-sm text-muted-foreground"
                : "text-sm text-destructive"
            }
            aria-live="polite"
          >
            {debit.equals(credit) && !debit.isZero()
              ? "Journal is balanced."
              : "Debits and credits must be equal and greater than zero."}
          </p>
        </div>
      </section>
    </ActionFormShell>
  );
}

function emptyLine(): Journal["lines"][number] {
  return {
    accountId: "",
    description: "",
    debit: "0.00",
    credit: "0.00",
    projectId: null,
    partyId: null,
  };
}
