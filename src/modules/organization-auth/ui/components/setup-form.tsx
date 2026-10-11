"use client";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { PasswordField } from "@/components/shared/form/password-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { credentials } from "../../schema";
import { setupAction } from "../../server/actions";
export function SetupForm() {
  const form = useZodForm(credentials, { name: "", email: "", password: "" });
  return (
    <ActionFormShell
      form={form}
      action={setupAction}
      submit="Create administrator"
    >
      <TextField
        control={form.control}
        name="name"
        label="Full name"
        required
        autoComplete="name"
      />
      <TextField
        control={form.control}
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
      />
      <PasswordField
        control={form.control}
        name="password"
        label="Password"
        minLength={12}
        required
        autoComplete="new-password"
      />
    </ActionFormShell>
  );
}
