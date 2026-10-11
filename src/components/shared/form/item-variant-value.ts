import type { LevelConfig } from "@/modules/item-variant/util";

export type PickerItem = {
  id: string;
  name: string;
  configs: LevelConfig[];
  stockUomId?: string;
  purchaseUomId?: string | null;
  defaultTaxGroupId?: string | null;
};

/** Legacy itemId/level1...level5 fields grouped into one RHF value. */
export type ItemVariantValue = {
  itemId: string | null;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  level4: string | null;
  level5: string | null;
};
