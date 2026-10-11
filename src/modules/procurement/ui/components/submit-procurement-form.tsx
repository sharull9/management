"use client";

import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { documentSubmissionInput } from "../../schema";
import { submitProcurementAction } from "../../server/actions";

export function SubmitProcurementForm({
  org,
  kind,
  id,
}: {
  org: string;
  kind: "requests" | "orders" | "receipts" | "transfers";
  id: string;
}) {
  const form = useZodForm(documentSubmissionInput, { kind, id });
  return (
    <ActionFormShell
      form={form}
      action={submitProcurementAction.bind(null, org)}
      submit="Submit for approval"
    >
      <span className="sr-only">Submit document for approval</span>
    </ActionFormShell>
  );
}
