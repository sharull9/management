import { EmptyState } from "@/components/shared/empty-state";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import type { MasterData as Data } from "../../type";
import { VariantForm } from "./variant-form";

type ItemRow = Data["items"][number];
/** Existing variants of an item plus the resolve-variant form. */
export function ItemVariants({
  org,
  data: d,
  item,
}: {
  org: string;
  data: Data;
  item: ItemRow;
}) {
  return (
    <div className="space-y-4">
      {item.variants.length ? (
        <ItemGroup>
          {item.variants.map((v) => (
            <Item key={v.id} variant="outline">
              <ItemContent>
                <ItemTitle>{v.name || item.name}</ItemTitle>
                <ItemDescription>{v.id}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <EmptyState title="No variants yet." />
      )}
      <VariantForm
        org={org}
        items={[
          {
            id: item.id,
            name: item.name,
            configs: d.levels.map((l) => {
              const c = item.levelConfigs.find((c) => c.definitionId === l.id);
              return {
                level: l.level,
                name: l.name,
                enabled: l.enabled,
                mode: c?.mode ?? "NOT_USED",
                required: c?.required ?? false,
                values: l.values.map((v) => ({ id: v.id, name: v.name })),
                linkedIds: c?.links.map((x) => x.valueId) ?? [],
              };
            }),
          },
        ]}
      />
    </div>
  );
}
