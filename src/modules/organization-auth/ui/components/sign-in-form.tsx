"use client";

import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { PasswordField } from "@/components/shared/form/password-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { signInInput } from "../../schema";
import { signInAction } from "../../server/actions";

export function SignInForm() {
  const form = useZodForm(signInInput, { email: "", password: "" });
  return (
    <ActionFormShell
      form={form}
      action={signInAction}
      submit="Sign in"
      submitClassName="w-full self-stretch"
    >
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
        required
        autoComplete="current-password"
      />
    </ActionFormShell>
  );
}
