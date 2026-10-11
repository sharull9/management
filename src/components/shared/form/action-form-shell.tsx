"use client";

import type { ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { ActionState } from "@/core/action-result";
import { cn } from "@/lib/utils";
import { useCloseOverlay } from "../overlay/overlay-context";
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
  submitClassName,
  destructive = false,
  onSuccess,
}: {
  form: UseFormReturn<TInput, unknown, TOutput>;
  action: TypedFormAction<TOutput>;
  children: ReactNode;
  submit?: string;
  className?: string;
  submitClassName?: string;
  destructive?: boolean;
  onSuccess?: (result: ActionState) => void;
}) {
  const closeOverlay = useCloseOverlay();
  const { onSubmit, pending, state } = useActionSubmit(
    form,
    action,
    (result) => {
      onSuccess?.(result);
      closeOverlay?.();
    },
  );
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
          className={cn("self-start", submitClassName)}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "Saving…" : submit}
        </Button>
      </fieldset>
    </form>
  );
}
