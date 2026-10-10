"use client";
import { useState } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/shared/fields";
import { Button } from "@/components/ui/button";
import { allocatePaymentAction } from "../../server/actions";

import type { Document } from "../../type";
export function AllocationFields({
  documents,
  values,
  onChange,
}: {
  documents: Document[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="allocations"
        value={JSON.stringify(
          Object.entries(values)
            .filter(([, v]) => v && v !== "0")
            .map(([documentId, amount]) => ({ documentId, amount })),
        )}
      />
      {documents.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No open approved documents for this selection.
        </p>
      )}
      {documents.map((d) => (
        <Field
          key={d.id}
          label={`${d.code} · ${d.currency} ${d.outstanding} outstanding`}
          type="number"
          min="0"
          max={d.outstanding}
          step="0.01"
          value={values[d.id] ?? ""}
          onChange={(e) => onChange({ ...values, [d.id]: e.target.value })}
        />
      ))}
    </div>
  );
}
export function AllocationForm({
  org,
  paymentId,
  documents,
}: {
  org: string;
  paymentId: string;
  documents: Document[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <ActionForm
      action={allocatePaymentAction.bind(null, org)}
      submit="Allocate payment"
    >
      <input type="hidden" name="id" value={paymentId} />
      <AllocationFields
        documents={documents}
        values={values}
        onChange={setValues}
      />
      <Button type="button" variant="outline" onClick={() => setValues({})}>
        Clear amounts
      </Button>
    </ActionForm>
  );
}
