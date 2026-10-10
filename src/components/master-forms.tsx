import Link from "next/link";
import type { ReactNode } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { Options } from "@/components/shared/form-options";
import {
  CheckField,
  ItemPicker,
  ItemTypeStockFields,
} from "@/components/shared/item-picker";
import {
  deleteMasterAction,
  resolveVariantAction,
  saveMasterAction,
} from "@/server/masters/actions";
import type { masterData } from "@/server/masters/queries";

type Data = Awaited<ReturnType<typeof masterData>>;
function MasterForm({
  org,
  kind,
  id,
  children,
}: {
  org: string;
  kind: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <>
      <ActionForm
        action={saveMasterAction.bind(null, org)}
        submit={id ? "Save changes" : "Create"}
      >
        <input type="hidden" name="kind" value={kind} />
        {id && <input type="hidden" name="id" value={id} />}
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      </ActionForm>
      {id && (
        <ActionForm
          action={deleteMasterAction.bind(null, org)}
          submit="Delete"
          destructive
          className="mt-3"
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
        </ActionForm>
      )}
    </>
  );
}
function Enum({
  label,
  name,
  values,
  selected,
}: {
  label: string;
  name: string;
  values: string[];
  selected?: string;
}) {
  return (
    <SelectField label={label} name={name} defaultValue={selected}>
      {values.map((v) => (
        <option key={v}>{v}</option>
      ))}
    </SelectField>
  );
}
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
export function PartyMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      {[null, ...d.parties].map((p) => (
        <FormCard
          key={p?.id ?? "new"}
          title={p ? `${p.code} · ${p.displayName}` : "Create party"}
        >
          <MasterForm org={org} kind="party" id={p?.id}>
            <Field label="Code" name="code" defaultValue={p?.code} required />
            <Field
              label="Legal name"
              name="legalName"
              defaultValue={p?.legalName}
              required
            />
            <Field
              label="Display name"
              name="displayName"
              defaultValue={p?.displayName}
              required
            />
            <Enum
              label="Type"
              name="type"
              values={["BUSINESS", "INDIVIDUAL"]}
              selected={p?.type}
            />
            <CheckField
              label="Vendor"
              name="isVendor"
              defaultChecked={p?.isVendor}
            />
            <CheckField
              label="Customer"
              name="isCustomer"
              defaultChecked={p?.isCustomer}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              defaultValue={p?.email ?? ""}
            />
            <Field label="Phone" name="phone" defaultValue={p?.phone ?? ""} />
            <Field
              label="Payment terms days"
              name="paymentTerms"
              type="number"
              min="0"
              defaultValue={p?.paymentTerms ?? 0}
            />
            <Field
              label="Credit limit"
              name="creditLimit"
              inputMode="decimal"
              defaultValue={p?.creditLimit.toString() ?? "0"}
            />
          </MasterForm>
          {p && (
            <div className="mt-6 space-y-4">
              <Link className="text-sm underline" href={`/${org}/projects`}>
                Customer project links
              </Link>
              {[null, ...p.addresses].map((a) => (
                <details key={a?.id ?? "new-address"}>
                  <summary>
                    {a ? `${a.label} · ${a.addressLine1}` : "Add address"}
                  </summary>
                  <MasterForm org={org} kind="address" id={a?.id}>
                    <input type="hidden" name="partyId" value={p.id} />
                    <Field
                      label="Label"
                      name="label"
                      defaultValue={a?.label ?? "Office"}
                      required
                    />
                    <Field
                      label="Address line 1"
                      name="addressLine1"
                      defaultValue={a?.addressLine1}
                      required
                    />
                    <Field
                      label="Address line 2"
                      name="addressLine2"
                      defaultValue={a?.addressLine2 ?? ""}
                    />
                    <Field
                      label="Postal code"
                      name="postalCode"
                      defaultValue={a?.postalCode ?? ""}
                    />
                    <SelectField
                      label="Country"
                      name="countryId"
                      defaultValue={a?.countryId ?? ""}
                    >
                      <Options rows={d.countries} />
                    </SelectField>
                    <SelectField
                      label="State"
                      name="stateId"
                      defaultValue={a?.stateId ?? ""}
                    >
                      <Options rows={d.states} />
                    </SelectField>
                    <SelectField
                      label="City"
                      name="cityId"
                      defaultValue={a?.cityId ?? ""}
                    >
                      <Options rows={d.cities} />
                    </SelectField>
                    <CheckField
                      label="Default address"
                      name="isDefault"
                      defaultChecked={a?.isDefault ?? true}
                    />
                  </MasterForm>
                </details>
              ))}
              {[null, ...p.contacts].map((c) => (
                <details key={c?.id ?? "new-contact"}>
                  <summary>{c?.name ?? "Add contact"}</summary>
                  <MasterForm org={org} kind="contact" id={c?.id}>
                    <input type="hidden" name="partyId" value={p.id} />
                    <Field
                      label="Name"
                      name="name"
                      defaultValue={c?.name}
                      required
                    />
                    <Field
                      label="Email"
                      name="email"
                      type="email"
                      defaultValue={c?.email ?? ""}
                    />
                    <Field
                      label="Phone"
                      name="phone"
                      defaultValue={c?.phone ?? ""}
                    />
                    <Field
                      label="Job title"
                      name="jobTitle"
                      defaultValue={c?.jobTitle ?? ""}
                    />
                    <CheckField
                      label="Primary contact"
                      name="isPrimary"
                      defaultChecked={c?.isPrimary}
                    />
                  </MasterForm>
                </details>
              ))}
              {[null, ...p.taxIdentifiers].map((t) => (
                <details key={t?.id ?? "new-tax"}>
                  <summary>
                    {t ? `${t.label}: ${t.value}` : "Add tax identifier"}
                  </summary>
                  <MasterForm org={org} kind="taxIdentifier" id={t?.id}>
                    <input type="hidden" name="partyId" value={p.id} />
                    <Field
                      label="Label"
                      name="label"
                      defaultValue={t?.label}
                      required
                    />
                    <Field
                      label="Value"
                      name="value"
                      defaultValue={t?.value}
                      required
                    />
                  </MasterForm>
                </details>
              ))}
            </div>
          )}
        </FormCard>
      ))}
    </>
  );
}
export function TaxMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      {[null, ...d.components].map((c) => (
        <FormCard
          key={c?.id ?? "new-component"}
          title={c?.name ?? "Create tax component"}
        >
          <MasterForm org={org} kind="taxComponent" id={c?.id}>
            <Field label="Name" name="name" defaultValue={c?.name} required />
            <Field label="Code" name="code" defaultValue={c?.code} required />
            <Field
              label="Rate %"
              name="rate"
              defaultValue={c?.rate.toString() ?? "0"}
              required
            />
            <Enum
              label="Applies to"
              name="appliesTo"
              values={["BOTH", "PURCHASE", "SALES"]}
              selected={c?.appliesTo}
            />
            <CheckField
              label="Withholding"
              name="isWithholding"
              defaultChecked={c?.isWithholding}
            />
          </MasterForm>
        </FormCard>
      ))}
      {[null, ...d.taxGroups].map((g) => (
        <FormCard
          key={g?.id ?? "new-group"}
          title={g?.name ?? "Create tax group"}
        >
          <MasterForm org={org} kind="taxGroup" id={g?.id}>
            <Field label="Name" name="name" defaultValue={g?.name} required />
            <SelectField
              label="Country"
              name="countryId"
              defaultValue={g?.countryId ?? ""}
            >
              <Options rows={d.countries} />
            </SelectField>
            <Enum
              label="Scope"
              name="scope"
              values={["ANY", "INTRA", "INTER"]}
              selected={g?.scope}
            />
            <SelectField
              label="Components"
              name="componentIds"
              multiple
              className="h-28"
              defaultValue={g?.components.map((x) => x.componentId) ?? []}
            >
              <Options rows={d.components} blank={false} />
            </SelectField>
          </MasterForm>
        </FormCard>
      ))}
    </>
  );
}
