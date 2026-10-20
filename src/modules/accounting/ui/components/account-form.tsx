"use client";

import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { accountInput, templateInput } from "../../schema";
import { saveAccountAction, saveTemplateAction } from "../../server/actions";

const accountTypes = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  EQUITY: "EQUITY",
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
};

export function AccountForm({
  org,
  template = false,
  account,
}: {
  org: string;
  template?: boolean;
  account?: z.input<typeof accountInput>;
}) {
  const schema = template ? templateInput : accountInput;
  const form = useZodForm<
    z.input<typeof accountInput>,
    z.output<typeof accountInput>
  >(schema, {
    id: account?.id,
    code: account?.code ?? "",
    name: account?.name ?? "",
    type: account?.type ?? "ASSET",
    active: account?.active ?? true,
  });
  return (
    <ActionFormShell
      form={form}
      action={(template ? saveTemplateAction : saveAccountAction).bind(
        null,
        org,
      )}
      submit={account ? "Save account" : "Create account"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="code"
          label="Account code"
          required
          maxLength={32}
        />
        <TextField
          control={form.control}
          name="name"
          label="Account name"
          required
          maxLength={120}
        />
        <ComboboxField
          control={form.control}
          name="type"
          label="Account type"
          options={enumOptions(accountTypes)}
        />
        <CheckboxField control={form.control} name="active" label="Active" />
      </div>
    </ActionFormShell>
  );
}
