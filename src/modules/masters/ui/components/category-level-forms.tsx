"use client";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { SelectField } from "@/components/shared/form/select-field";
import { TextField } from "@/components/shared/form/text-field";
import { FormCard } from "@/components/shared/form-card";
import { Item, ItemContent } from "@/components/ui/item";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";
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
          <MasterForm
            org={org}
            kind="category"
            id={c?.id}
            defaultValues={{
              name: c?.name ?? "",
              parentId: (c?.parentId ?? "") || null,
            }}
          >
            {(form) => (
              <>
                <TextField
                  control={form.control}
                  label="Name"
                  name="name"
                  required
                />
                <SelectField
                  control={form.control}
                  label="Parent (maximum depth 5)"
                  name="parentId"
                  options={toOptions(
                    d.categories
                      .filter((x) => x.id !== c?.id)
                      .map((x) => ({ id: x.id, name: path(x.id) })),
                  )}
                  clearable
                />
              </>
            )}
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
            <MasterForm
              org={org}
              kind="level"
              id={level?.id}
              defaultValues={{
                level: levelNumber,
                name: level?.name ?? "",
                enabled: level?.enabled ?? true,
              }}
            >
              {(form) => (
                <>
                  <TextField
                    control={form.control}
                    label="Level name"
                    name="name"
                    required
                  />
                  <CheckboxField
                    control={form.control}
                    label="Enabled"
                    name="enabled"
                  />
                </>
              )}
            </MasterForm>
            {level && (
              <div className="mt-6 space-y-4">
                {[null, ...level.values].map((v) => (
                  <Item key={v?.id ?? "new"} variant="outline">
                    <ItemContent>
                      <details open={!v}>
                        <summary>{v?.name ?? "Add value"}</summary>
                        <MasterForm
                          org={org}
                          kind="levelValue"
                          id={v?.id}
                          defaultValues={{
                            definitionId: level.id,
                            name: v?.name ?? "",
                          }}
                        >
                          {(form) => (
                            <>
                              <TextField
                                control={form.control}
                                label="Value name"
                                name="name"
                                required
                              />
                            </>
                          )}
                        </MasterForm>
                      </details>
                    </ItemContent>
                  </Item>
                ))}
              </div>
            )}
          </FormCard>
        );
      })}
    </>
  );
}
