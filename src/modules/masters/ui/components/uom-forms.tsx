"use client";
import {
  CheckboxField,
  SelectField,
  TextField,
} from "@/components/shared/form";
import { toOptions } from "@/components/shared/form/enum-options";
import { FormCard } from "@/components/shared/form-card";
import { Item, ItemContent } from "@/components/ui/item";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";
export function UomMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      <FormCard title="Create UOM group with base unit">
        <MasterForm
          org={org}
          kind="uomGroup"
          defaultValues={{ name: "", key: "", baseCode: "", baseName: "" }}
        >
          {(form) => (
            <>
              <TextField
                control={form.control}
                label="Group name"
                name="name"
                required
              />
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
        </MasterForm>
      </FormCard>
      {d.groups.map((g) => (
        <FormCard
          key={g.id}
          title={`${g.name}${!g.tenantId ? " · System (read-only)" : ""}`}
        >
          {g.tenantId && (
            <MasterForm
              org={org}
              kind="uomGroup"
              id={g.id}
              defaultValues={{ name: g.name ?? "" }}
            >
              {(form) => (
                <>
                  <TextField
                    control={form.control}
                    label="Group name"
                    name="name"
                    required
                  />
                </>
              )}
            </MasterForm>
          )}
          {d.uoms
            .filter((u) => u.groupId === g.id)
            .map((u) => (
              <Item key={u.id} variant="outline">
                <ItemContent>
                  <details className="mt-3 rounded border p-3">
                    <summary>
                      {u.code} · {u.name} · factor {u.factor}
                      {u.isBase ? " · Base" : ""}
                      {!u.tenantId ? " · System" : ""}
                    </summary>
                    {u.tenantId && (
                      <MasterForm
                        org={org}
                        kind="uom"
                        id={u.id}
                        defaultValues={{
                          groupId: g.id,
                          code: u.code ?? "",
                          name: u.name ?? "",
                          factor: u.factor ?? "",
                          isBase: u.isBase ?? false,
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
                    )}
                  </details>
                </ItemContent>
              </Item>
            ))}
        </FormCard>
      ))}
      <FormCard title="Create unit">
        <MasterForm
          org={org}
          kind="uom"
          defaultValues={{
            groupId: null,
            code: "",
            name: "",
            factor: "1",
            isBase: false,
          }}
        >
          {(form) => (
            <>
              <SelectField
                control={form.control}
                label="Group"
                name="groupId"
                options={toOptions(d.groups)}
                clearable
              />
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
      </FormCard>
    </>
  );
}
