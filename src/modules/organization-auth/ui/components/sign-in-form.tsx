"use client";

import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { PasswordField } from "@/components/shared/form/password-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import type { ActionState } from "@/core/action-result";
import { authClient } from "@/core/auth/auth-client";
import { signInInput } from "../../schema";

export function SignInForm() {
  const form = useZodForm(signInInput, { email: "", password: "" });
  async function signIn(input: {
    email: string;
    password: string;
  }): Promise<ActionState> {
    const { data, error } = await authClient.signIn.email(input);
    if (error) return { error: error.message };
    if (!data) return { error: "Unable to sign in. Please try again." };
    return { redirectTo: "/" };
  }
  return (
    <ActionFormShell
      form={form}
      action={signIn}
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
