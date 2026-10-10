import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { Options } from "@/components/shared/form-options";
import { CheckField } from "@/components/shared/item-picker";

import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";
export function UomMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      <FormCard title="Create UOM group with base unit">
        <MasterForm org={org} kind="uomGroup">
          <Field label="Group name" name="name" required />
          <Field label="Group key" name="key" required />
          <Field label="Base unit code" name="baseCode" required />
          <Field label="Base unit name" name="baseName" required />
        </MasterForm>
      </FormCard>
      {d.groups.map((g) => (
        <FormCard
          key={g.id}
          title={`${g.name}${!g.tenantId ? " · System (read-only)" : ""}`}
        >
          {g.tenantId && (
            <MasterForm org={org} kind="uomGroup" id={g.id}>
              <Field
                label="Group name"
                name="name"
                defaultValue={g.name}
                required
              />
            </MasterForm>
          )}
          {d.uoms
            .filter((u) => u.groupId === g.id)
            .map((u) => (
              <details key={u.id} className="mt-3 rounded border p-3">
                <summary>
                  {u.code} · {u.name} · factor {u.factor.toString()}
                  {u.isBase ? " · Base" : ""}
                  {!u.tenantId ? " · System" : ""}
                </summary>
                {u.tenantId && (
                  <MasterForm org={org} kind="uom" id={u.id}>
                    <input type="hidden" name="groupId" value={g.id} />
                    <Field
                      label="Code"
                      name="code"
                      defaultValue={u.code}
                      required
                    />
                    <Field
                      label="Name"
                      name="name"
                      defaultValue={u.name}
                      required
                    />
                    <Field
                      label="Factor to base"
                      name="factor"
                      defaultValue={u.factor.toString()}
                      required
                    />
                    <CheckField
                      label="Base unit"
                      name="isBase"
                      defaultChecked={u.isBase}
                    />
                  </MasterForm>
                )}
              </details>
            ))}
        </FormCard>
      ))}
      <FormCard title="Create unit">
        <MasterForm org={org} kind="uom">
          <SelectField label="Group" name="groupId" required>
            <Options rows={d.groups} blank={false} />
          </SelectField>
          <Field label="Code" name="code" required />
          <Field label="Name" name="name" required />
          <Field
            label="Factor to base"
            name="factor"
            defaultValue="1"
            required
          />
          <CheckField label="Base unit" name="isBase" />
        </MasterForm>
      </FormCard>
    </>
  );
}
