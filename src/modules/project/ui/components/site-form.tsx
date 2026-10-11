"use client";
import { useEffect, useMemo, useRef } from "react";
import { useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox";
import {
  ActionFormShell,
  TextField,
  useZodForm,
} from "@/components/shared/form";
import { toOptions } from "@/components/shared/form/enum-options";
import { deleteInput, siteFormInput } from "../../schema";
import {
  findCities,
  findCountries,
  findStates,
} from "../../server/picker-actions";
import { deleteSiteAction, siteAction } from "../../server/site-actions";
import type { Site } from "../../type";
export function SiteForm({
  org,
  projectId,
  site,
  countries,
  states,
  cities,
}: {
  org: string;
  projectId: string;
  site?: Site;
  countries: { id: string; name: string }[];
  states: { id: string; name: string; countryId: string }[];
  cities: { id: string; name: string; stateId: string }[];
}) {
  const form = useZodForm<
    z.input<typeof siteFormInput>,
    z.output<typeof siteFormInput>
  >(siteFormInput, {
    id: site?.id ?? null,
    name: site?.name ?? "",
    address: site?.address ?? "",
    pincode: site?.pincode ?? null,
    countryId: site?.countryId ?? null,
    stateId: site?.stateId ?? null,
    cityId: site?.cityId ?? null,
    latitude: site?.latitude ?? "",
    longitude: site?.longitude ?? "",
  });
  const country = useWatch({ control: form.control, name: "countryId" });
  const state = useWatch({ control: form.control, name: "stateId" });
  const loadCountries = useMemo(
    () => findCountries.bind(null, org, projectId),
    [org, projectId],
  );
  const loadStates = useMemo(
    () => findStates.bind(null, org, projectId, country),
    [org, projectId, country],
  );
  const loadCities = useMemo(
    () => findCities.bind(null, org, projectId, state),
    [org, projectId, state],
  );
  const previousCountry = useRef(country);
  const previousState = useRef(state);
  useEffect(() => {
    if (previousCountry.current !== country) {
      previousCountry.current = country;
      form.setValue("stateId", null);
      form.setValue("cityId", null);
    }
  }, [country, form]);
  useEffect(() => {
    if (previousState.current !== state) {
      previousState.current = state;
      form.setValue("cityId", null);
    }
  }, [state, form]);
  return (
    <ActionFormShell
      form={form}
      action={siteAction.bind(null, org, projectId)}
      submit={site ? "Save site" : "Create site"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Site name"
          required
        />
        <TextField
          control={form.control}
          name="address"
          label="Site address"
          required
        />
        <ComboboxField
          control={form.control}
          name="countryId"
          label="Country"
          options={toOptions(countries)}
          loadOptions={loadCountries}
          clearable
        />
        <ComboboxField
          control={form.control}
          key={`state:${country}`}
          name="stateId"
          label="State"
          options={toOptions(states.filter((s) => s.countryId === country))}
          loadOptions={loadStates}
          clearable
        />
        <ComboboxField
          control={form.control}
          key={`city:${state}`}
          name="cityId"
          label="City"
          options={toOptions(cities.filter((c) => c.stateId === state))}
          loadOptions={loadCities}
          clearable
        />
        <TextField control={form.control} name="pincode" label="Pincode" />
        <TextField
          control={form.control}
          name="latitude"
          label="Latitude"
          inputMode="decimal"
        />
        <TextField
          control={form.control}
          name="longitude"
          label="Longitude"
          inputMode="decimal"
        />
      </div>
    </ActionFormShell>
  );
}
export function DeleteSiteForm({
  org,
  projectId,
  id,
}: {
  org: string;
  projectId: string;
  id: string;
}) {
  const form = useZodForm<
    z.input<typeof deleteInput>,
    z.output<typeof deleteInput>
  >(deleteInput, { id });
  return (
    <ActionFormShell
      form={form}
      action={deleteSiteAction.bind(null, org, projectId)}
      submit="Delete site"
      destructive
    >
      {null}
    </ActionFormShell>
  );
}
