import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { Options } from "@/components/shared/form-options";
import {
  CheckField,
  ItemPicker,
  ItemTypeStockFields,
} from "@/components/shared/item-picker";
import { resolveVariantAction } from "../../server/actions";

import type { MasterData as Data } from "../../type";
import { Enum, MasterForm } from "./master-form";
export function CategoryMasters({ org, data: d }: { org: string; data: Data }) {
  function path(categoryId: string): string {
    const c = d.categories.find((c) => c.id === categoryId);
    return c ? `${c.parentId ? `${path(c.parentId)} / ` : ""}${c.name}` : "";
  }
  return (
    <>
      {[null, ...d.categories].map((c) => (
        <FormCard
          key={c?.id ?? "new"}
          title={c ? path(c.id) : "Create category"}
        >
          <MasterForm org={org} kind="category" id={c?.id}>
            <Field label="Name" name="name" defaultValue={c?.name} required />
            <SelectField
              label="Parent (maximum depth 5)"
              name="parentId"
              defaultValue={c?.parentId ?? ""}
            >
              <Options
                rows={d.categories
                  .filter((x) => x.id !== c?.id)
                  .map((x) => ({ id: x.id, name: path(x.id) }))}
              />
            </SelectField>
          </MasterForm>
        </FormCard>
      ))}
    </>
  );
}
export function LevelMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      {[1, 2, 3, 4, 5].map((levelNumber) => {
        const level = d.levels.find((l) => l.level === levelNumber);
        return (
          <FormCard key={levelNumber} title={`Level ${levelNumber}`}>
            <MasterForm org={org} kind="level" id={level?.id}>
              <input type="hidden" name="level" value={levelNumber} />
              <Field
                label="Level name"
                name="name"
                defaultValue={level?.name}
                required
              />
              <CheckField
                label="Enabled"
                name="enabled"
                defaultChecked={level?.enabled ?? true}
              />
            </MasterForm>
            {level && (
              <div className="mt-6 space-y-4">
                {[null, ...level.values].map((v) => (
                  <details key={v?.id ?? "new"} open={!v}>
                    <summary>{v?.name ?? "Add value"}</summary>
                    <MasterForm org={org} kind="levelValue" id={v?.id}>
                      <input
                        type="hidden"
                        name="definitionId"
                        value={level.id}
                      />
                      <Field
                        label="Value name"
                        name="name"
                        defaultValue={v?.name}
                        required
                      />
                    </MasterForm>
                  </details>
                ))}
              </div>
            )}
          </FormCard>
        );
      })}
    </>
  );
}
export function ItemMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      {[null, ...d.items].map((item) => (
        <FormCard
          key={item?.id ?? "new"}
          title={item ? `${item.code} · ${item.name}` : "Create item"}
        >
          <MasterForm org={org} kind="item" id={item?.id}>
            <Field
              label="Code"
              name="code"
              defaultValue={item?.code}
              required
            />
            <Field
              label="Name"
              name="name"
              defaultValue={item?.name}
              required
            />
            <ItemTypeStockFields
              type={item?.type}
              stockTracked={item?.stockTracked}
            />
            <SelectField
              label="Category"
              name="categoryId"
              defaultValue={item?.categoryId ?? ""}
            >
              <Options rows={d.categories} />
            </SelectField>
            <SelectField
              label="Stock UOM"
              name="stockUomId"
              defaultValue={item?.stockUomId}
              required
            >
              <Options rows={d.uoms} blank={false} />
            </SelectField>
            <SelectField
              label="Purchase UOM (same group)"
              name="purchaseUomId"
              defaultValue={item?.purchaseUomId ?? ""}
            >
              <Options rows={d.uoms} />
            </SelectField>
            <Field
              label="Tax code (HSN / SAC)"
              name="taxCode"
              defaultValue={item?.taxCode ?? ""}
            />
            <SelectField
              label="Default tax group"
              name="defaultTaxGroupId"
              defaultValue={item?.defaultTaxGroupId ?? ""}
            >
              <Options rows={d.taxGroups} />
            </SelectField>
            <Field
              label="Description"
              name="description"
              defaultValue={item?.description ?? ""}
            />
            <CheckField
              label="Active"
              name="active"
              defaultChecked={item?.active ?? true}
            />
            {d.levels.map((l) => {
              const config = item?.levelConfigs.find(
                (c) => c.definitionId === l.id,
              );
              return (
                <fieldset key={l.id} className="space-y-3 rounded border p-3">
                  <legend>
                    {l.name}
                    {!l.enabled ? " (disabled)" : ""}
                  </legend>
                  <Enum
                    label="Mode"
                    name={`mode${l.level}`}
                    values={["NOT_USED", "ANY", "LINKED"]}
                    selected={config?.mode}
                  />
                  <CheckField
                    label="Required"
                    name={`required${l.level}`}
                    defaultChecked={config?.required}
                  />
                  <SelectField
                    label="Allowed linked values"
                    name={`links${l.level}`}
                    multiple
                    defaultValue={config?.links.map((x) => x.valueId) ?? []}
                    className="h-24"
                  >
                    <Options rows={l.values} blank={false} />
                  </SelectField>
                </fieldset>
              );
            })}
          </MasterForm>
          {item && (
            <>
              <h3 className="mt-6 font-medium">Variants</h3>
              <ul className="my-3 space-y-1 text-sm">
                {item.variants.map((v) => (
                  <li key={v.id}>
                    {v.name || item.name} · {v.id}
                  </li>
                ))}
              </ul>
              <ActionForm
                action={resolveVariantAction.bind(null, org)}
                submit="Resolve variant"
              >
                <ItemPicker
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
                  defaultItemId={item.id}
                />
              </ActionForm>
            </>
          )}
        </FormCard>
      ))}
    </>
  );
}
