import type {
  ItemVariantValue,
  PickerItem,
} from "@/components/shared/form/item-variant-value";
export type ProcurementItem = PickerItem & { uomIds: string[] };
export type DraftLine = {
  itemId: string;
  levels: (string | null)[];
  qty: string;
  uomId: string;
  description?: string;
  estimatedRate?: string;
  rate?: string;
  discountPercent?: string;
  taxGroupId?: string | null;
  prLineId?: string | null;
  poLineId?: string;
  receivedQty?: string;
  acceptedQty?: string;
  rejectedQty?: string;
  remarks?: string;
};
export type Choice = { id: string; name: string; projectId?: string };
export type ProcurementFormData = {
  /** Organization base currency; stock and valuation are in it. */
  baseCurrency: string;
  /** Currencies enabled for documents (base first). */
  currencies: { code: string; name: string }[];
  projects: { id: string; name: string; currency: string }[];
  items: ProcurementItem[];
  uoms: Choice[];
  vendors: (Choice & { defaultCurrency: string | null })[];
  groups: { id: string; name: string; scope: string }[];
  sites: Choice[];
  stages: Choice[];
  tasks: Choice[];
  taxSuggestions: { vendorId: string; scope: string }[];
  prLines: { id: string; name: string; projectId: string; line: DraftLine }[];
  orders: {
    id: string;
    name: string;
    projectId: string;
    currency: string;
    lines: {
      id: string;
      name: string;
      itemId: string;
      item: ItemVariantValue;
      uomId: string;
      pending: string;
    }[];
  }[];
};
