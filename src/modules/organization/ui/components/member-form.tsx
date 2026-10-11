"use client";
import { useEffect, useMemo } from "react";
import { useWatch } from "react-hook-form";
import type { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { enumOptions } from "@/components/shared/form/enum-options";
import { PasswordField } from "@/components/shared/form/password-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { saveMemberInput } from "../../schema";
import { saveMemberAction } from "../../server/member-actions";
import { findTenantUsers } from "../../server/picker-actions";

const roles = enumOptions({ member: "member", admin: "admin", owner: "owner" });
export function MemberForm({
  org,
  member,
  customRoles,
}: {
  org: string;
  member?: z.input<typeof saveMemberInput>;
  customRoles: Option[];
}) {
  const form = useZodForm<
    z.input<typeof saveMemberInput>,
    z.output<typeof saveMemberInput>
  >(
    saveMemberInput,
    member ?? {
      existingEmail: null,
      email: "",
      name: "",
      password: "",
      role: "member",
      roleId: null,
    },
  );
  const loadUsers = useMemo(() => findTenantUsers.bind(null, org), [org]);
  const selectedEmail = useWatch({
    control: form.control,
    name: "existingEmail",
  });
  useEffect(() => {
    if (selectedEmail) {
      form.setValue("email", selectedEmail, { shouldValidate: true });
      form.setValue("password", "");
    }
  }, [selectedEmail, form]);
  return (
    <ActionFormShell
      form={form}
      action={saveMemberAction.bind(null, org)}
      submit={member ? "Update member" : "Add member"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!member && (
          <>
            <ComboboxField
              control={form.control}
              name="existingEmail"
              label="Existing tenant account"
              options={[]}
              loadOptions={loadUsers}
              clearable
              description="Search this tenant's accounts, or enter an email below."
            />
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              required
            />
            <TextField
              control={form.control}
              name="name"
              label="Full name (new users)"
            />
            <PasswordField
              control={form.control}
              name="password"
              label="Temporary password (new users)"
              autoComplete="new-password"
            />
          </>
        )}
        <ComboboxField
          control={form.control}
          name="role"
          label="Base role"
          options={roles}
        />
        <ComboboxField
          control={form.control}
          name="roleId"
          label="Custom role"
          options={customRoles}
          clearable
          placeholder="None"
        />
      </div>
      {!member && (
        <p className="text-xs text-muted-foreground">
          New users need a name and a password of at least 12 characters.
          Existing passwords are kept.
        </p>
      )}
    </ActionFormShell>
  );
}
