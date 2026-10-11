"use client";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { TextField } from "@/components/shared/form/text-field";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";

type LevelRow = Data["levels"][number];

/** Create (no `level`) or edit form for one item level definition. */
export function LevelForm({
  org,
  levelNumber,
  level,
}: {
  org: string;
  levelNumber: number;
  level?: LevelRow;
}) {
  const listHref = `/${org}/masters/levels`;
  return (
    <MasterForm
      org={org}
      kind="level"
      id={level?.id}
      afterCreate={listHref}
      afterDelete={listHref}
      defaultValues={{
        level: levelNumber,
        name: level?.name ?? "",
        enabled: level?.enabled ?? true,
      }}
    >
      {(form) => (
        <>
          <TextField
            control={form.control}
            label="Level name"
            name="name"
            required
          />
          <CheckboxField
            control={form.control}
            label="Enabled"
            name="enabled"
          />
        </>
      )}
    </MasterForm>
  );
}
