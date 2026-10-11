"use client";
import {
  ActionFormShell,
  useActionSubmit,
  useZodForm,
} from "@/components/shared/form";
import { FieldFrame } from "@/components/shared/form/field-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { billAttachmentFormInput, billDocumentInput } from "../../schema";
import { attachBillAction, submitBillAction } from "../../server/actions";

export function SubmitBillForm({
  org,
  billId,
}: {
  org: string;
  billId: string;
}) {
  const form = useZodForm(billDocumentInput, { id: billId });
  return (
    <ActionFormShell
      form={form}
      action={submitBillAction.bind(null, org)}
      submit="Submit for approval"
    >
      {null}
    </ActionFormShell>
  );
}
export function AttachBillForm({
  org,
  billId,
}: {
  org: string;
  billId: string;
}) {
  const form = useZodForm(billAttachmentFormInput, { id: billId });
  const { onSubmit, pending, state } = useActionSubmit(form, (input) => {
    const data = new FormData();
    data.set("id", input.id);
    data.set("file", input.attachment);
    return attachBillAction(org, {}, data);
  });
  return (
    <form onSubmit={onSubmit} aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4 border-0 p-0">
        <FieldFrame
          control={form.control}
          name="attachment"
          label="Vendor invoice copy (PDF, PNG or JPEG, max 900 KB)"
        >
          {(field, accessibility) => (
            <Input
              {...accessibility}
              ref={field.ref}
              onBlur={field.onBlur}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(event) => field.onChange(event.target.files?.[0])}
            />
          )}
        </FieldFrame>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Attaching..." : "Attach vendor invoice"}
        </Button>
      </fieldset>
    </form>
  );
}
