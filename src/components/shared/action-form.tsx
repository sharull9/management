"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/core/action-result";
import { useCloseOverlay } from "./overlay/overlay-context";

export type FormAction = (
  state: ActionState,
  data: FormData,
) => Promise<ActionState>;
export function ActionForm({
  action,
  children,
  submit = "Save",
  className = "space-y-4",
  destructive = false,
}: {
  action: FormAction;
  children?: ReactNode;
  submit?: string;
  className?: string;
  destructive?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  const closeOverlay = useCloseOverlay();
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.message) toast.success(state.message);
    if (state.message && !state.error) closeOverlay?.();
    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router, closeOverlay]);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="space-y-4 border-0 p-0">
        {children}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        variant={destructive ? "destructive" : "default"}
      >
        {pending ? "Saving…" : submit}
      </Button>
    </form>
  );
}
