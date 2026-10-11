"use client";

import {
  ActionFormShell,
  PasswordField,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { signInInput } from "../../schema";
import { signInAction } from "../../server/actions";

export function SignInForm() {
  const form = useZodForm(signInInput, { email: "", password: "" });
  return (
    <ActionFormShell form={form} action={signInAction} submit="Sign in">
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
