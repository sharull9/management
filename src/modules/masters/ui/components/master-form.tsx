"use client";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import type { ActionState } from "@/core/action-result";
import { deleteMasterInput, saveMasterInput } from "../../schema";
import { deleteMasterAction, saveMasterAction } from "../../server/actions";
import type { MasterKind } from "../../type";

type Input = z.input<typeof saveMasterInput>;

/** Adds a client navigation to a successful result via ActionState.redirectTo. */
function withRedirect<T>(
  action: (input: T) => Promise<ActionState>,
  redirectTo?: string,
) {
  if (!redirectTo) return action;
  return async (input: T) => {
    const result = await action(input);
    return result.error || result.fieldErrors
      ? result
      : { ...result, redirectTo };
  };
}

export function MasterForm({
  org,
  kind,
  id,
  defaultValues,
  afterCreate,
  afterDelete,
  children,
}: {
  org: string;
  kind: MasterKind;
  id?: string;
  defaultValues: Omit<Input, "kind" | "id">;
  /** Path to navigate to after a successful create (no `id`). */
  afterCreate?: string;
  /** Path to navigate to after a successful delete. */
  afterDelete?: string;
  children: (form: UseFormReturn<Input, unknown, Input>) => ReactNode;
}) {
  const form = useZodForm(saveMasterInput, { ...defaultValues, kind, id });
  return (
    <>
      <ActionFormShell
        form={form}
        action={withRedirect(
          saveMasterAction.bind(null, org),
          id ? undefined : afterCreate,
        )}
        submit={id ? "Save changes" : "Create"}
      >
        <div className="grid gap-4 sm:grid-cols-2">{children(form)}</div>
      </ActionFormShell>
      {id && (
        <DeleteMasterForm
          org={org}
          kind={kind}
          id={id}
          redirectTo={afterDelete}
        />
      )}
    </>
  );
}
function DeleteMasterForm({
  org,
  kind,
  id,
  redirectTo,
}: {
  org: string;
  kind: MasterKind;
  id: string;
  redirectTo?: string;
}) {
  const form = useZodForm(deleteMasterInput, { kind, id });
  return (
    <ActionFormShell
      form={form}
      action={withRedirect(deleteMasterAction.bind(null, org), redirectTo)}
      submit="Delete"
      destructive
      className="mt-3"
    >
      {null}
    </ActionFormShell>
  );
}
