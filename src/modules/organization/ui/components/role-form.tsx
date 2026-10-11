"use client";
import { Controller } from "react-hook-form";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { permissionGroups } from "@/core/permissions";
import { saveRoleInput } from "../../schema";
import { saveRoleAction } from "../../server/role-actions";
export function RoleForm({
  org,
  role,
}: {
  org: string;
  role?: z.input<typeof saveRoleInput>;
}) {
  const form = useZodForm(
    saveRoleInput,
    role ?? { id: null, name: "", description: "", permissions: [] },
  );
  return (
    <ActionFormShell
      form={form}
      action={saveRoleAction.bind(null, org)}
      submit={role ? "Save" : "Create role"}
    >
      <TextField
        control={form.control}
        name="name"
        label="Role name"
        required
      />
      <TextField
        control={form.control}
        name="description"
        label="Description"
      />
      <Controller
        control={form.control}
        name="permissions"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(permissionGroups).map(([group, permissions]) => (
                <fieldset
                  key={group}
                  className="space-y-2 rounded-lg border p-4"
                >
                  <legend className="px-2 text-sm font-medium">{group}</legend>
                  {Object.entries(permissions).map(([key, label]) => (
                    <Field key={key} orientation="horizontal">
                      <Checkbox
                        id={`${form.formState.defaultValues?.id ?? "new"}-${key}`}
                        checked={field.value.includes(key)}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, key]
                              : field.value.filter((p) => p !== key),
                          )
                        }
                      />
                      <FieldLabel
                        htmlFor={`${form.formState.defaultValues?.id ?? "new"}-${key}`}
                      >
                        {label}
                      </FieldLabel>
                    </Field>
                  ))}
                </fieldset>
              ))}
            </div>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
    </ActionFormShell>
  );
}
