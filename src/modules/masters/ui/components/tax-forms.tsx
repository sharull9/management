import { Field, SelectField } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { Options } from "@/components/shared/form-options";
import { CheckField } from "@/components/shared/item-picker";

import type { MasterData as Data } from "../../type";
import { Enum, MasterForm } from "./master-form";
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
