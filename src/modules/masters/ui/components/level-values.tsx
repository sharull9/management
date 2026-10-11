"use client";
import { TextField } from "@/components/shared/form/text-field";
import { Item, ItemContent, ItemGroup } from "@/components/ui/item";
import type { MasterData as Data } from "../../type";
import { MasterForm } from "./master-form";

type LevelRow = Data["levels"][number];

/** Values of one level, each editable, plus an "add value" form. */
export function LevelValues({ org, level }: { org: string; level: LevelRow }) {
  return (
    <ItemGroup className="space-y-4">
      {[null, ...level.values].map((v) => (
        <Item key={v?.id ?? "new"} variant="outline">
          <ItemContent>
            <details open={!v}>
              <summary>{v?.name ?? "Add value"}</summary>
              <MasterForm
                org={org}
                kind="levelValue"
                id={v?.id}
                defaultValues={{ definitionId: level.id, name: v?.name ?? "" }}
              >
                {(form) => (
                  <TextField
                    control={form.control}
                    label="Value name"
                    name="name"
                    required
                  />
                )}
              </MasterForm>
            </details>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
