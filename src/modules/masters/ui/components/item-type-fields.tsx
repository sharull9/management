"use client";
import { useEffect, useRef } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import type { z } from "zod";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions } from "@/components/shared/form/enum-options";
import { SelectField } from "@/components/shared/form/select-field";
import { itemTypeSchema, type saveMasterInput } from "../../schema";

type Input = z.input<typeof saveMasterInput>;
export function ItemTypeFields({
  form,
}: {
  form: UseFormReturn<Input, unknown, Input>;
}) {
  const type = useWatch({ control: form.control, name: "type" });
  const previous = useRef(type);
  useEffect(() => {
    if (previous.current !== type) {
      form.setValue("stockTracked", type !== "SERVICE", { shouldDirty: true });
      previous.current = type;
    }
  }, [form, type]);
  return (
    <>
      <SelectField
        control={form.control}
        name="type"
        label="Type"
        options={enumOptions(itemTypeSchema.enum)}
      />
      <CheckboxField
        control={form.control}
        name="stockTracked"
        label="Track stock"
      />
    </>
  );
}
