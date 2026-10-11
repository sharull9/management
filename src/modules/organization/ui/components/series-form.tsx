"use client";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { NumberField } from "@/components/shared/form/number-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { saveSeriesInput } from "../../schema";
import { saveSeriesAction } from "../../server/numbering-actions";
export function SeriesForm({
  org,
  series,
}: {
  org: string;
  series?: z.input<typeof saveSeriesInput>;
}) {
  const form = useZodForm(
    saveSeriesInput,
    series ?? { type: "", prefix: "", padding: 4, nextNumber: 1 },
  );
  return (
    <ActionFormShell
      form={form}
      action={saveSeriesAction.bind(null, org)}
      submit={series ? "Save" : "Add series"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!series && (
          <TextField
            control={form.control}
            name="type"
            label="Document type"
            placeholder="PROJECT"
            required
          />
        )}
        <TextField
          control={form.control}
          name="prefix"
          label="Prefix"
          placeholder="PRJ-"
        />
        <NumberField
          control={form.control}
          name="padding"
          label="Padding"
          min={1}
          max={12}
          required
        />
        <NumberField
          control={form.control}
          name="nextNumber"
          label="Next number"
          min={series?.nextNumber ?? 1}
          required
        />
      </div>
    </ActionFormShell>
  );
}
