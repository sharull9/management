"use client";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { TextareaField } from "@/components/shared/form/textarea-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { submitRequestInput, voidPaymentInput } from "../../schema";
import { submitRequestAction, voidPaymentAction } from "../../server/actions";
export function SubmitRequestForm({ org, id }: { org: string; id: string }) {
  const form = useZodForm(submitRequestInput, { id });
  return (
    <ActionFormShell
      form={form}
      action={submitRequestAction.bind(null, org)}
      submit="Submit for approval"
    >
      {null}
    </ActionFormShell>
  );
}
export function VoidPaymentForm({ org, id }: { org: string; id: string }) {
  const form = useZodForm(voidPaymentInput, { id, reason: "" });
  return (
    <ActionFormShell
      form={form}
      action={voidPaymentAction.bind(null, org)}
      submit="Void and reverse allocations"
      destructive
    >
      <TextareaField
        control={form.control}
        name="reason"
        label="Reason for voiding"
        maxLength={1000}
      />
    </ActionFormShell>
  );
}
