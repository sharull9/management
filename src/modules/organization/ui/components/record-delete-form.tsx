"use client";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import type { TypedFormAction } from "@/components/shared/form/use-action-submit";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { recordIdInput } from "../../schema";
export function RecordDeleteForm({
  id,
  action,
  submit,
}: {
  id: string;
  action: TypedFormAction<{ id: string }>;
  submit: string;
}) {
  const form = useZodForm(recordIdInput, { id });
  return (
    <ActionFormShell form={form} action={action} submit={submit} destructive>
      {null}
    </ActionFormShell>
  );
}
