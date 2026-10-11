"use client";
import { FieldFrame } from "@/components/shared/form/field-frame";
import { useActionSubmit } from "@/components/shared/form/use-action-submit";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { useCloseOverlay } from "@/components/shared/overlay/overlay-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { billAttachmentFormInput } from "../../schema";
import { attachBillAction } from "../../server/actions";

export function AttachBillForm({
  org,
  billId,
}: {
  org: string;
  billId: string;
}) {
  const closeOverlay = useCloseOverlay();
  const form = useZodForm(billAttachmentFormInput, { id: billId });
  const { onSubmit, pending, state } = useActionSubmit(
    form,
    (input) => {
      const data = new FormData();
      data.set("id", input.id);
      data.set("file", input.attachment);
      return attachBillAction(org, {}, data);
    },
    () => closeOverlay?.(),
  );
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
