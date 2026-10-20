"use client";

import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextareaField } from "@/components/shared/form/textarea-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { journalIdInput, reverseJournalInput } from "../../schema";
import {
  reverseJournalAction,
  submitJournalAction,
} from "../../server/actions";
import { todayUtcDate } from "./form-helpers";

export function JournalActions({
  org,
  id,
  status,
  canSubmit,
  canReverse,
}: {
  org: string;
  id: string;
  status: string;
  canSubmit: boolean;
  canReverse: boolean;
}) {
  const submitForm = useZodForm(journalIdInput, { id });
  const submit = submitJournalAction.bind(null, org);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSubmit && status === "DRAFT" && (
        <ActionFormShell
          form={submitForm}
          action={submit}
          submit="Submit for approval"
          className="flex-row items-center"
        >
          {null}
        </ActionFormShell>
      )}
      {canReverse && status === "POSTED" && (
        <ReverseJournalForm org={org} id={id} />
      )}
    </div>
  );
}

function ReverseJournalForm({ org, id }: { org: string; id: string }) {
  const form = useZodForm<
    z.input<typeof reverseJournalInput>,
    z.output<typeof reverseJournalInput>
  >(reverseJournalInput, { id, date: todayUtcDate(), reason: "" });
  const action = reverseJournalAction.bind(null, org);
  return (
    <SideSheet
      title="Reverse journal"
      description="This creates an opposite journal entry. Posted history remains unchanged."
      trigger="Reverse journal"
      triggerVariant="outline"
      triggerSize="sm"
      width="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Confirm the reversal date and enter a reason. The date cannot be
          earlier than the original journal date.
        </p>
        <ActionFormShell
          form={form}
          action={action}
          submit="Confirm reversal"
          destructive
        >
          <DateField control={form.control} name="date" label="Reversal date" />
          <TextareaField
            control={form.control}
            name="reason"
            label="Reason"
            required
            maxLength={500}
          />
        </ActionFormShell>
      </div>
    </SideSheet>
  );
}
