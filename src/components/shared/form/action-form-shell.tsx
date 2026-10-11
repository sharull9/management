"use client";

import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { type TypedFormAction, useActionSubmit } from "./use-action-submit";

export function ActionFormShell<
  TInput extends FieldValues,
  TOutput extends FieldValues,
>({
  form,
  action,
  children,
  submit = "Save",
  className,
  destructive = false,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  action: TypedFormAction<TOutput>;
  children: ReactNode;
  submit?: string;
  className?: string;
  destructive?: boolean;
}) {
  const { onSubmit, pending, state } = useActionSubmit(form, action);
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={className}
      aria-busy={pending}
    >
      <fieldset
        disabled={pending}
        className="flex min-w-0 flex-col gap-4 border-0 p-0"
      >
        <FieldGroup>{children}</FieldGroup>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button
          type="submit"
          disabled={pending}
          variant={destructive ? "destructive" : "default"}
          className="self-start"
        >
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "Saving…" : submit}
        </Button>
      </fieldset>
    </form>
  );
}
