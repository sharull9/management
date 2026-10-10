import type { PickerItem } from "@/components/shared/item-picker";
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
  projects: { id: string; name: string; currency: string }[];
  items: PickerItem[];
  uoms: Choice[];
  vendors: Choice[];
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
    lines: { id: string; name: string; uomId: string; pending: string }[];
  }[];
};
