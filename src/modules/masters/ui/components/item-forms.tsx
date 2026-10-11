"use client";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { EmptyState } from "@/components/shared/empty-state";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { FormCard } from "@/components/shared/form-card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { itemModeSchema } from "../../schema";
import type { MasterData as Data } from "../../type";
import { ItemTypeFields } from "./item-type-fields";
import { MasterForm } from "./master-form";
import { VariantForm } from "./variant-form";
export function ItemMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      {[null, ...d.items].map((item) => (
        <FormCard
          key={item?.id ?? "new"}
          title={item ? `${item.code} · ${item.name}` : "Create item"}
        >
          <MasterForm
            org={org}
            kind="item"
            id={item?.id}
            defaultValues={{
              code: item?.code ?? "",
              name: item?.name ?? "",
              type: item?.type ?? "PRODUCT",
              stockTracked: item?.stockTracked ?? item?.type !== "SERVICE",
              categoryId: (item?.categoryId ?? "") || null,
              stockUomId: item?.stockUomId || null,
              purchaseUomId: (item?.purchaseUomId ?? "") || null,
              taxCode: item?.taxCode ?? "",
              defaultTaxGroupId: (item?.defaultTaxGroupId ?? "") || null,
              description: item?.description ?? "",
              active: item?.active ?? true,
              ...Object.fromEntries(
                d.levels.flatMap((l) => {
                  const config = item?.levelConfigs.find(
                    (c) => c.definitionId === l.id,
                  );
                  return [
                    [`mode${l.level}`, config?.mode ?? "NOT_USED"],
                    [`required${l.level}`, config?.required ?? false],
                    [
                      `links${l.level}`,
                      config?.links.map((x) => x.valueId) ?? [],
                    ],
                  ];
                }),
              ),
            }}
          >
            {(form) => (
              <>
                <TextField
                  control={form.control}
                  label="Code"
                  name="code"
                  required
                />
                <TextField
                  control={form.control}
                  label="Name"
                  name="name"
                  required
                />
                <ItemTypeFields form={form} />
                <ComboboxField
                  control={form.control}
                  label="Category"
                  name="categoryId"
                  options={toOptions(d.categories)}
                  clearable
                />
                <ComboboxField
                  control={form.control}
                  label="Stock UOM"
                  name="stockUomId"
                  options={toOptions(d.uoms)}
                  clearable
                />
                <ComboboxField
                  control={form.control}
                  label="Purchase UOM (same group)"
                  name="purchaseUomId"
                  options={toOptions(d.uoms)}
                  clearable
                />
                <TextField
                  control={form.control}
                  label="Tax code (HSN / SAC)"
                  name="taxCode"
                />
                <ComboboxField
                  control={form.control}
                  label="Default tax group"
                  name="defaultTaxGroupId"
                  options={toOptions(d.taxGroups)}
                  clearable
                />
                <TextField
                  control={form.control}
                  label="Description"
                  name="description"
                />
                <CheckboxField
                  control={form.control}
                  label="Active"
                  name="active"
                />
                {d.levels.map((l) => {
                  return (
                    <fieldset
                      key={l.id}
                      className="space-y-3 rounded border p-3"
                    >
                      <legend>
                        {l.name}
                        {!l.enabled ? " (disabled)" : ""}
                      </legend>
                      <ComboboxField
                        control={form.control}
                        label="Mode"
                        name={`mode${l.level as 1 | 2 | 3 | 4 | 5}`}
                        options={enumOptions(itemModeSchema.enum)}
                      />
                      <CheckboxField
                        control={form.control}
                        label="Required"
                        name={`required${l.level as 1 | 2 | 3 | 4 | 5}`}
                      />
                      <ComboboxField
                        multiple
                        control={form.control}
                        label="Allowed linked values"
                        name={`links${l.level as 1 | 2 | 3 | 4 | 5}`}
                        options={toOptions(l.values)}
                      />
                    </fieldset>
                  );
                })}
              </>
            )}
          </MasterForm>
          {item && (
            <>
              <h3 className="mt-6 font-medium">Variants</h3>
              <ItemGroup className="my-3">
                {item.variants.map((v) => (
                  <Item key={v.id} variant="outline">
                    <ItemContent>
                      <ItemTitle>{v.name || item.name}</ItemTitle>
                      <ItemDescription>{v.id}</ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
              {!item.variants.length && <EmptyState title="No variants yet." />}
              <VariantForm
                org={org}
                items={[
                  {
                    id: item.id,
                    name: item.name,
                    configs: d.levels.map((l) => {
                      const c = item.levelConfigs.find(
                        (c) => c.definitionId === l.id,
                      );
                      return {
                        level: l.level,
                        name: l.name,
                        enabled: l.enabled,
                        mode: c?.mode ?? "NOT_USED",
                        required: c?.required ?? false,
                        values: l.values.map((v) => ({
                          id: v.id,
                          name: v.name,
                        })),
                        linkedIds: c?.links.map((x) => x.valueId) ?? [],
                      };
                    }),
                  },
                ]}
              />
            </>
          )}
        </FormCard>
      ))}
    </>
  );
}
