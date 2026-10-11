"use client";
import Link from "next/link";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions, toOptions } from "@/components/shared/form/enum-options";
import { NumberField } from "@/components/shared/form/number-field";
import { SelectField } from "@/components/shared/form/select-field";
import { TextField } from "@/components/shared/form/text-field";
import { FormCard } from "@/components/shared/form-card";
import { Item, ItemContent } from "@/components/ui/item";
import { partyTypeSchema } from "../../schema";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";
export function PartyMasters({ org, data: d }: { org: string; data: Data }) {
  return (
    <>
      {[null, ...d.parties].map((p) => (
        <FormCard
          key={p?.id ?? "new"}
          title={p ? `${p.code} · ${p.displayName}` : "Create party"}
        >
          <MasterForm
            org={org}
            kind="party"
            id={p?.id}
            defaultValues={{
              code: p?.code ?? "",
              legalName: p?.legalName ?? "",
              displayName: p?.displayName ?? "",
              type: p?.type ?? "BUSINESS",
              isVendor: p?.isVendor ?? false,
              isCustomer: p?.isCustomer ?? false,
              email: p?.email ?? "",
              phone: p?.phone ?? "",
              paymentTerms: p?.paymentTerms ?? 0,
              creditLimit: p?.creditLimit ?? "0",
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
                  label="Legal name"
                  name="legalName"
                  required
                />
                <TextField
                  control={form.control}
                  label="Display name"
                  name="displayName"
                  required
                />
                <SelectField
                  control={form.control}
                  label="Type"
                  name="type"
                  options={enumOptions(partyTypeSchema.enum)}
                />
                <CheckboxField
                  control={form.control}
                  label="Vendor"
                  name="isVendor"
                />
                <CheckboxField
                  control={form.control}
                  label="Customer"
                  name="isCustomer"
                />
                <TextField
                  control={form.control}
                  label="Email"
                  name="email"
                  type="email"
                />
                <TextField control={form.control} label="Phone" name="phone" />
                <NumberField
                  control={form.control}
                  label="Payment terms days"
                  name="paymentTerms"
                  min="0"
                />
                <TextField
                  control={form.control}
                  label="Credit limit"
                  name="creditLimit"
                  inputMode="decimal"
                />
              </>
            )}
          </MasterForm>
          {p && (
            <div className="mt-6 space-y-4">
              <Link className="text-sm underline" href={`/${org}/projects`}>
                Customer project links
              </Link>
              {[null, ...p.addresses].map((a) => (
                <Item key={a?.id ?? "new-address"} variant="outline">
                  <ItemContent>
                    <details>
                      <summary>
                        {a ? `${a.label} · ${a.addressLine1}` : "Add address"}
                      </summary>
                      <MasterForm
                        org={org}
                        kind="address"
                        id={a?.id}
                        defaultValues={{
                          partyId: p.id,
                          label: a?.label ?? "Office",
                          addressLine1: a?.addressLine1 ?? "",
                          addressLine2: a?.addressLine2 ?? "",
                          postalCode: a?.postalCode ?? "",
                          countryId: (a?.countryId ?? "") || null,
                          stateId: (a?.stateId ?? "") || null,
                          cityId: (a?.cityId ?? "") || null,
                          isDefault: a?.isDefault ?? true,
                        }}
                      >
                        {(form) => (
                          <>
                            <TextField
                              control={form.control}
                              label="Label"
                              name="label"
                              required
                            />
                            <TextField
                              control={form.control}
                              label="Address line 1"
                              name="addressLine1"
                              required
                            />
                            <TextField
                              control={form.control}
                              label="Address line 2"
                              name="addressLine2"
                            />
                            <TextField
                              control={form.control}
                              label="Postal code"
                              name="postalCode"
                            />
                            <SelectField
                              control={form.control}
                              label="Country"
                              name="countryId"
                              options={toOptions(d.countries)}
                              clearable
                            />
                            <SelectField
                              control={form.control}
                              label="State"
                              name="stateId"
                              options={toOptions(d.states)}
                              clearable
                            />
                            <SelectField
                              control={form.control}
                              label="City"
                              name="cityId"
                              options={toOptions(d.cities)}
                              clearable
                            />
                            <CheckboxField
                              control={form.control}
                              label="Default address"
                              name="isDefault"
                            />
                          </>
                        )}
                      </MasterForm>
                    </details>
                  </ItemContent>
                </Item>
              ))}
              {[null, ...p.contacts].map((c) => (
                <Item key={c?.id ?? "new-contact"} variant="outline">
                  <ItemContent>
                    <details>
                      <summary>{c?.name ?? "Add contact"}</summary>
                      <MasterForm
                        org={org}
                        kind="contact"
                        id={c?.id}
                        defaultValues={{
                          partyId: p.id,
                          name: c?.name ?? "",
                          email: c?.email ?? "",
                          phone: c?.phone ?? "",
                          jobTitle: c?.jobTitle ?? "",
                          isPrimary: c?.isPrimary ?? false,
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
                            <TextField
                              control={form.control}
                              label="Email"
                              name="email"
                              type="email"
                            />
                            <TextField
                              control={form.control}
                              label="Phone"
                              name="phone"
                            />
                            <TextField
                              control={form.control}
                              label="Job title"
                              name="jobTitle"
                            />
                            <CheckboxField
                              control={form.control}
                              label="Primary contact"
                              name="isPrimary"
                            />
                          </>
                        )}
                      </MasterForm>
                    </details>
                  </ItemContent>
                </Item>
              ))}
              {[null, ...p.taxIdentifiers].map((t) => (
                <Item key={t?.id ?? "new-tax"} variant="outline">
                  <ItemContent>
                    <details>
                      <summary>
                        {t ? `${t.label}: ${t.value}` : "Add tax identifier"}
                      </summary>
                      <MasterForm
                        org={org}
                        kind="taxIdentifier"
                        id={t?.id}
                        defaultValues={{
                          partyId: p.id,
                          label: t?.label ?? "",
                          value: t?.value ?? "",
                        }}
                      >
                        {(form) => (
                          <>
                            <TextField
                              control={form.control}
                              label="Label"
                              name="label"
                              required
                            />
                            <TextField
                              control={form.control}
                              label="Value"
                              name="value"
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
      ))}
    </>
  );
}
