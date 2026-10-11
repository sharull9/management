"use client";
import { ActionFormShell, useZodForm } from "@/components/shared/form";
import { submitInvoiceInput } from "../../schema";
import { submitInvoiceAction } from "../../server/actions";
export function InvoiceSubmit({ org, id }: { org: string; id: string }) {
  const form = useZodForm(submitInvoiceInput, { id });
  return (
    <ActionFormShell
      form={form}
      action={submitInvoiceAction.bind(null, org)}
      submit="Submit"
    >
      {null}
    </ActionFormShell>
  );
}
