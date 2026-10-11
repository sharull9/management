"use client";
import {
  ActionFormShell,
  type TypedFormAction,
  useZodForm,
} from "@/components/shared/form";
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
