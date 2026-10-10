import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import type {
  City,
  Country,
  Organization,
  State,
} from "@/generated/prisma/client";
import { saveOrganizationAction } from "@/server/actions";
export function OrganizationForm({
  tenantId,
  orgSlug = null,
  org,
  countries,
  states,
  cities = [],
}: {
  tenantId: string;
  orgSlug?: string | null;
  org?: Organization;
  countries: Country[];
  states: State[];
  cities?: City[];
}) {
  return (
    <ActionForm
      action={saveOrganizationAction.bind(null, orgSlug)}
      submit={org ? "Save organization" : "Create organization"}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      {org && <input type="hidden" name="id" value={org.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Organization name"
          name="name"
          defaultValue={org?.name}
          required
        />
        <Field
          label="URL slug"
          name="slug"
          defaultValue={org?.slug}
          placeholder="acme-builders"
          required
        />
        <Field
          label="Legal name"
          name="legalName"
          defaultValue={org?.legalName ?? ""}
        />
        <Field
          label="Base currency"
          name="baseCurrency"
          defaultValue={org?.baseCurrency ?? "INR"}
          maxLength={3}
          required
        />
        <SelectField
          label="Country"
          name="countryId"
          defaultValue={org?.countryId ?? ""}
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
          defaultValue={org?.stateId ?? ""}
        >
          <option value="">Select state</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {countries.find((c) => c.id === s.countryId)?.code} · {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="City"
          name="cityId"
          defaultValue={org?.cityId ?? ""}
        >
          <option value="">Select city</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <Field
          label="Postal code"
          name="postalCode"
          defaultValue={org?.postalCode ?? ""}
        />
        <Field
          label="Address line 1"
          name="addressLine1"
          defaultValue={org?.addressLine1 ?? ""}
        />
        <Field
          label="Address line 2"
          name="addressLine2"
          defaultValue={org?.addressLine2 ?? ""}
        />
      </div>
    </ActionForm>
  );
}
