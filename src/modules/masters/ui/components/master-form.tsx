import type { ReactNode } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { SelectField } from "@/components/shared/fields";

import { deleteMasterAction, saveMasterAction } from "../../server/actions";

export function MasterForm({
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
export function Enum({
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
