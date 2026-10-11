"use client";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import type { MasterData as Data } from "../../type";
import { categoryPath } from "../category-path";
import { MasterForm } from "./master-form";

type CategoryRow = Data["categories"][number];

/** Create (no `category`) or edit form for one category. */
export function CategoryForm({
  org,
  data: d,
  category,
}: {
  org: string;
  data: Data;
  category?: CategoryRow;
}) {
  const listHref = `/${org}/masters/categories`;
  return (
    <MasterForm
      org={org}
      kind="category"
      id={category?.id}
      afterCreate={listHref}
      afterDelete={listHref}
      defaultValues={{
        name: category?.name ?? "",
        parentId: (category?.parentId ?? "") || null,
      }}
    >
      {(form) => (
        <>
          <TextField control={form.control} label="Name" name="name" required />
          <ComboboxField
            control={form.control}
            label="Parent (maximum depth 5)"
            name="parentId"
            options={toOptions(
              d.categories
                .filter((x) => x.id !== category?.id)
                .map((x) => ({
                  id: x.id,
                  name: categoryPath(d.categories, x.id),
                })),
            )}
            clearable
          />
        </>
      )}
    </MasterForm>
  );
}
