"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionState } from "@/core/action-result";

export type TypedFormAction<T> = (input: T) => Promise<ActionState>;

export function useActionSubmit<
  TInput extends FieldValues,
  TOutput extends FieldValues,
>(
  form: UseFormReturn<TInput, unknown, TOutput>,
  action: TypedFormAction<TOutput>,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});
  const submitting = useRef(false);
  const onSubmit = form.handleSubmit((input) => {
    if (submitting.current) return;
    submitting.current = true;
    form.clearErrors();
    startTransition(async () => {
      try {
        const result = await action(input);
        setState(result);
        for (const [name, messages] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          form.setError(name ? (name as Path<TInput>) : "root.server", {
            type: "server",
            message: messages.join(" "),
          });
        }
        if (result.error) toast.error(result.error);
        if (result.message) toast.success(result.message);
        if (result.redirectTo) {
          router.push(result.redirectTo);
          router.refresh();
        }
      } catch {
        const error = "Unable to submit. Please try again.";
        setState({ error });
        toast.error(error);
      } finally {
        submitting.current = false;
      }
    });
  });
  return { onSubmit, pending: pending || form.formState.isSubmitting, state };
}
