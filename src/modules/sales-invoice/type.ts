import type { PickerItem } from "@/components/shared/item-picker";
import type { TaxInput } from "@/modules/tax";

type Choice = { id: string; name: string };
export type InvoiceDraftLine = {
  itemId: string | null;
  levels: (string | null)[];
  description: string;
  qty: string;
  uomId: string;
  rate: string;
  discountPercent: string;
  taxGroupId: string | null;
  fromProjectStock: boolean;
};
export type InvoiceFormData = {
  items: PickerItem[];
  uoms: Choice[];
  states: Choice[];
  orgStateId: string | null;
  allowOrgInvoices: boolean;
  projects: (Choice & { clientPartyId: string | null })[];
  customers: (Choice & { stateId: string | null; paymentTerms: number })[];
  groups: (Choice & { scope: string; components: TaxInput[] })[];
};
