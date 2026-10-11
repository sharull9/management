"use client";
import { EmptyState } from "@/components/shared/empty-state";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { TextField } from "@/components/shared/form/text-field";
import { FormCard } from "@/components/shared/form-card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";

type GroupRow = Data["groups"][number];
type UomRow = Data["uoms"][number];

/** Create (no `group`) or rename form for one UOM group. */
export function UomGroupForm({
  org,
  group,
}: {
  org: string;
  group?: GroupRow;
}) {
  const listHref = `/${org}/masters/uoms`;
  return (
    <MasterForm
      org={org}
      kind="uomGroup"
      id={group?.id}
      afterCreate={listHref}
      afterDelete={listHref}
      defaultValues={
        group
          ? { name: group.name ?? "" }
          : { name: "", key: "", baseCode: "", baseName: "" }
      }
    >
      {(form) => (
        <>
          <TextField
            control={form.control}
            label="Group name"
            name="name"
            required
          />
          {!group && (
            <>
              <TextField
                control={form.control}
                label="Group key"
                name="key"
                required
              />
              <TextField
                control={form.control}
                label="Base unit code"
                name="baseCode"
                required
              />
              <TextField
                control={form.control}
                label="Base unit name"
                name="baseName"
                required
              />
            </>
          )}
        </>
      )}
    </MasterForm>
  );
}

/** Create (no `unit`) or edit form for one unit inside a group. */
function UomForm({
  org,
  groupId,
  unit,
}: {
  org: string;
  groupId: string;
  unit?: UomRow;
}) {
  return (
    <MasterForm
      org={org}
      kind="uom"
      id={unit?.id}
      defaultValues={{
        groupId,
        code: unit?.code ?? "",
        name: unit?.name ?? "",
        factor: unit?.factor ?? "1",
        isBase: unit?.isBase ?? false,
      }}
    >
      {(form) => (
        <>
          <TextField control={form.control} label="Code" name="code" required />
          <TextField control={form.control} label="Name" name="name" required />
          <TextField
            control={form.control}
            label="Factor to base"
            name="factor"
            required
          />
          <CheckboxField
            control={form.control}
            label="Base unit"
            name="isBase"
          />
        </>
      )}
    </MasterForm>
  );
}

/** Units and conversion factors of a group, with the add-unit form. */
export function UomUnits({
  org,
  data: d,
  group,
}: {
  org: string;
  data: Data;
  group: GroupRow;
}) {
  const units = d.uoms.filter((u) => u.groupId === group.id);
  return (
    <div className="space-y-4">
      {units.length ? (
        <ItemGroup>
          {units.map((u) => (
            <Item key={u.id} variant="outline">
              <ItemContent>
                <details>
                  <summary>
                    <ItemTitle className="inline-flex">
                      {u.code} · {u.name} · factor {u.factor}
                      {u.isBase ? " · Base" : ""}
                      {!u.tenantId ? " · System" : ""}
                    </ItemTitle>
                  </summary>
                  {u.tenantId && (
                    <div className="mt-3">
                      <UomForm org={org} groupId={group.id} unit={u} />
                    </div>
                  )}
                </details>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <EmptyState title="No units yet." />
      )}
      <FormCard title="Add unit">
        <UomForm org={org} groupId={group.id} />
      </FormCard>
    </div>
  );
}
