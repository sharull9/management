"use client";
import type { ReactNode } from "react";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";

type PartyRow = Data["parties"][number];
type Place = { id: string; name: string };
export type PartyLocations = {
  countries: Place[];
  states: (Place & { countryId: string })[];
  cities: (Place & { stateId: string })[];
};
type RecordEntry = { key: string; summary: string; form: ReactNode };

/** Existing records as collapsible edit forms, then a "add" form. */
function RecordList({
  records,
  add,
}: {
  records: RecordEntry[];
  add: Omit<RecordEntry, "key">;
}) {
  return (
    <ItemGroup className="gap-3">
      {[...records, { key: `new-${records.length}`, ...add }].map((r) => (
        <Item key={r.key} variant="outline">
          <ItemContent>
            <details open={r.key.startsWith("new-") && records.length === 0}>
              <summary className="cursor-pointer text-sm font-medium">
                {r.summary}
              </summary>
              <div className="pt-4">{r.form}</div>
            </details>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

export function PartyAddresses({
  org,
  locations,
  party,
}: {
  org: string;
  locations: PartyLocations;
  party: PartyRow;
}) {
  const form = (a?: PartyRow["addresses"][number]) => (
    <MasterForm
      org={org}
      kind="address"
      id={a?.id}
      defaultValues={{
        partyId: party.id,
        label: a?.label ?? "Office",
        addressLine1: a?.addressLine1 ?? "",
        addressLine2: a?.addressLine2 ?? "",
        postalCode: a?.postalCode ?? "",
        countryId: (a?.countryId ?? "") || null,
        stateId: (a?.stateId ?? "") || null,
        cityId: (a?.cityId ?? "") || null,
        isDefault: a?.isDefault ?? party.addresses.length === 0,
      }}
    >
      {(f) => (
        <>
          <TextField control={f.control} label="Label" name="label" required />
          <TextField
            control={f.control}
            label="Address line 1"
            name="addressLine1"
            required
          />
          <TextField
            control={f.control}
            label="Address line 2"
            name="addressLine2"
          />
          <TextField
            control={f.control}
            label="Postal code"
            name="postalCode"
          />
          <ComboboxField
            control={f.control}
            label="Country"
            name="countryId"
            options={toOptions(locations.countries)}
            clearable
          />
          <ComboboxField
            control={f.control}
            label="State"
            name="stateId"
            options={toOptions(
              locations.states.filter(
                (s) => s.countryId === f.watch("countryId"),
              ),
            )}
            clearable
          />
          <ComboboxField
            control={f.control}
            label="City"
            name="cityId"
            options={toOptions(
              locations.cities.filter((c) => c.stateId === f.watch("stateId")),
            )}
            clearable
          />
          <CheckboxField
            control={f.control}
            label="Default address"
            name="isDefault"
          />
        </>
      )}
    </MasterForm>
  );
  return (
    <RecordList
      records={party.addresses.map((a) => ({
        key: a.id,
        summary: `${a.label} · ${a.addressLine1}`,
        form: form(a),
      }))}
      add={{ summary: "Add address", form: form() }}
    />
  );
}

export function PartyContacts({
  org,
  party,
}: {
  org: string;
  party: PartyRow;
}) {
  const form = (c?: PartyRow["contacts"][number]) => (
    <MasterForm
      org={org}
      kind="contact"
      id={c?.id}
      defaultValues={{
        partyId: party.id,
        name: c?.name ?? "",
        email: c?.email ?? "",
        phone: c?.phone ?? "",
        jobTitle: c?.jobTitle ?? "",
        isPrimary: c?.isPrimary ?? false,
      }}
    >
      {(f) => (
        <>
          <TextField control={f.control} label="Name" name="name" required />
          <TextField
            control={f.control}
            label="Email"
            name="email"
            type="email"
          />
          <TextField control={f.control} label="Phone" name="phone" />
          <TextField control={f.control} label="Job title" name="jobTitle" />
          <CheckboxField
            control={f.control}
            label="Primary contact"
            name="isPrimary"
          />
        </>
      )}
    </MasterForm>
  );
  return (
    <RecordList
      records={party.contacts.map((c) => ({
        key: c.id,
        summary: c.name,
        form: form(c),
      }))}
      add={{ summary: "Add contact", form: form() }}
    />
  );
}

export function PartyTaxIdentifiers({
  org,
  party,
}: {
  org: string;
  party: PartyRow;
}) {
  const form = (t?: PartyRow["taxIdentifiers"][number]) => (
    <MasterForm
      org={org}
      kind="taxIdentifier"
      id={t?.id}
      defaultValues={{
        partyId: party.id,
        label: t?.label ?? "",
        value: t?.value ?? "",
      }}
    >
      {(f) => (
        <>
          <TextField control={f.control} label="Label" name="label" required />
          <TextField control={f.control} label="Value" name="value" required />
        </>
      )}
    </MasterForm>
  );
  return (
    <RecordList
      records={party.taxIdentifiers.map((t) => ({
        key: t.id,
        summary: `${t.label}: ${t.value}`,
        form: form(t),
      }))}
      add={{ summary: "Add tax identifier", form: form() }}
    />
  );
}
