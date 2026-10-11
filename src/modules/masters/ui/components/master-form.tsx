"use client";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { deleteMasterInput, saveMasterInput } from "../../schema";
import { deleteMasterAction, saveMasterAction } from "../../server/actions";
import type { MasterKind } from "../../type";

type Input = z.input<typeof saveMasterInput>;
export function MasterForm({
  org,
  kind,
  id,
  defaultValues,
  children,
}: {
  org: string;
  kind: MasterKind;
  id?: string;
  defaultValues: Omit<Input, "kind" | "id">;
  children: (form: UseFormReturn<Input, unknown, Input>) => ReactNode;
}) {
  const form = useZodForm(saveMasterInput, { ...defaultValues, kind, id });
  return (
    <>
      <ActionFormShell
        form={form}
        action={saveMasterAction.bind(null, org)}
        submit={id ? "Save changes" : "Create"}
      >
        <div className="grid gap-4 sm:grid-cols-2">{children(form)}</div>
      </ActionFormShell>
      {id && <DeleteMasterForm org={org} kind={kind} id={id} />}
    </>
  );
}
function DeleteMasterForm({
  org,
  kind,
  id,
}: {
  org: string;
  kind: MasterKind;
  id: string;
}) {
  const form = useZodForm(deleteMasterInput, { kind, id });
  return (
    <ActionFormShell
      form={form}
      action={deleteMasterAction.bind(null, org)}
      submit="Delete"
      destructive
      className="mt-3"
    >
      {null}
    </ActionFormShell>
  );
}
