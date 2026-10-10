import Link from "next/link";

import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { Options } from "@/components/shared/form-options";
import { CheckField } from "@/components/shared/item-picker";

import type { MasterData as Data } from "../../type";
import { Enum, MasterForm } from "./master-form";
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
