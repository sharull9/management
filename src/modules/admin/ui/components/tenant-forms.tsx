"use client";
import type { z } from "zod";
import {
  ActionFormShell,
  PasswordField,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { createTenantInput, tenantStatusInput } from "../../schema";
import { createTenantAction, tenantStatusAction } from "../../server/actions";
export function CreateTenantForm() {
  const form = useZodForm(createTenantInput, {
    name: "",
    slug: "",
    ownerName: "",
    email: "",
    password: "",
  });
  return (
    <ActionFormShell
      form={form}
      action={createTenantAction}
      submit="Create tenant"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Tenant name"
          required
        />
        <TextField
          control={form.control}
          name="slug"
          label="Tenant slug"
          required
        />
        <TextField
          control={form.control}
          name="ownerName"
          label="Owner name"
          required
        />
        <TextField
          control={form.control}
          name="email"
          label="Owner email"
          type="email"
          required
        />
        <PasswordField
          control={form.control}
          name="password"
          label="Temporary password (new users only)"
          autoComplete="new-password"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        New users need a password of at least 12 characters. An existing account
        keeps its password.
      </p>
    </ActionFormShell>
  );
}
export function TenantStatusForm({
  tenantId,
  status,
}: {
  tenantId: string;
  status: "ACTIVE" | "SUSPENDED";
}) {
  const form = useZodForm<
    z.input<typeof tenantStatusInput>,
    z.output<typeof tenantStatusInput>
  >(tenantStatusInput, {
    tenantId,
    status: status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
  });
  return (
    <ActionFormShell
      form={form}
      action={tenantStatusAction}
      submit={status === "ACTIVE" ? "Suspend" : "Activate"}
      destructive={status === "ACTIVE"}
    >
      {null}
    </ActionFormShell>
  );
}
