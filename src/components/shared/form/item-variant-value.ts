export type { PickerItem } from "../item-picker";

/** Legacy itemId/level1...level5 fields grouped into one RHF value. */
export type ItemVariantValue = {
  itemId: string | null;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  level4: string | null;
  level5: string | null;
};
