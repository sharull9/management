"use client";
import { useState } from "react";
import type { FormAction } from "@/components/shared/action-form";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";

type Site = {
  id: string;
  name: string;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  address: string;
  pincode: string | null;
  latitude: string | null;
  longitude: string | null;
};
export function SiteForm({
  action,
  site,
  countries,
  states,
  cities,
}: {
  action: FormAction;
  site?: Site;
  countries: { id: string; name: string }[];
  states: { id: string; name: string; countryId: string }[];
  cities: { id: string; name: string; stateId: string }[];
}) {
  const [country, setCountry] = useState(site?.countryId ?? "");
  const [state, setState] = useState(site?.stateId ?? "");
  const [city, setCity] = useState(site?.cityId ?? "");
  return (
    <ActionForm action={action} submit={site ? "Save site" : "Create site"}>
      {site && <input type="hidden" name="id" value={site.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Site name"
          name="name"
          defaultValue={site?.name}
          required
        />
        <Field
          label="Site address"
          name="address"
          defaultValue={site?.address}
          required
        />
        <SelectField
          label="Country"
          name="countryId"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setState("");
            setCity("");
          }}
        >
          <option value="">Select country</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="State"
          name="stateId"
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setCity("");
          }}
        >
          <option value="">Select state</option>
          {states
            .filter((s) => s.countryId === country)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </SelectField>
        <SelectField
          label="City"
          name="cityId"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          <option value="">Select city</option>
          {cities
            .filter((c) => c.stateId === state)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </SelectField>
        <Field
          label="Pincode"
          name="pincode"
          defaultValue={site?.pincode ?? ""}
        />
        <Field
          label="Latitude"
          name="latitude"
          defaultValue={site?.latitude ?? ""}
          inputMode="decimal"
        />
        <Field
          label="Longitude"
          name="longitude"
          defaultValue={site?.longitude ?? ""}
          inputMode="decimal"
        />
      </div>
    </ActionForm>
  );
}
