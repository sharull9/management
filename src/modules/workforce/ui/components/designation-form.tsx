"use client";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { designationInput } from "../../schema";
import { designationAction } from "../../server/actions";
export function DesignationForm({
  org,
  designation,
  remove = false,
}: {
  org: string;
  designation?: { id: string; name: string };
  remove?: boolean;
}) {
  const form = useZodForm<
    z.input<typeof designationInput>,
    z.output<typeof designationInput>
  >(
    designationInput,
    remove && designation
      ? { operation: "DELETE", id: designation.id }
      : {
          operation: "SAVE",
          id: designation?.id ?? null,
          name: designation?.name ?? "",
        },
  );
  return (
    <ActionFormShell
      form={form}
      action={designationAction.bind(null, org)}
      destructive={remove}
      submit={
        remove
          ? "Delete designation"
          : designation
            ? "Save designation"
            : "Create designation"
      }
    >
      {!remove && (
        <TextField
          control={form.control}
          name="name"
          label="Designation name"
        />
      )}
    </ActionFormShell>
  );
}
