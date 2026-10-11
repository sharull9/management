"use client";
import { useCallback, useState } from "react";
import {
  ActionFormShell,
  ItemVariantField,
  type PickerItem,
  useZodForm,
} from "@/components/shared/form";
import { variantFormInput } from "../../schema";
import { resolveVariantAction } from "../../server/actions";
import { findItems } from "../../server/picker-actions";
export function VariantForm({
  org,
  items,
}: {
  org: string;
  items: PickerItem[];
}) {
  const [loaded, setLoaded] = useState<PickerItem[]>([]);
  const loadItems = useCallback(
    async (query: string) => {
      const results = await findItems(org, query);
      setLoaded((previous) => [
        ...new Map(
          [...previous, ...results].map((item) => [item.id, item]),
        ).values(),
      ]);
      return results;
    },
    [org],
  );
  const form = useZodForm(variantFormInput([...loaded, ...items]), {
    selection: {
      itemId: items[0]?.id ?? null,
      level1: null,
      level2: null,
      level3: null,
      level4: null,
      level5: null,
    },
  });
  return (
    <ActionFormShell
      form={form}
      action={resolveVariantAction.bind(null, org)}
      submit="Resolve variant"
    >
      <ItemVariantField
        control={form.control}
        name="selection"
        items={items}
        loadItems={loadItems}
      />
    </ActionFormShell>
  );
}
