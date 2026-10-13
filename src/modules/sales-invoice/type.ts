import type { PickerItem } from "@/components/shared/form/item-variant-value";
import type { TaxInput } from "@/modules/tax/util";

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
  customers: (Choice & {
    stateId: string | null;
    paymentTerms: number;
    defaultCurrency: string | null;
  })[];
  baseCurrency: string;
  groups: (Choice & { scope: string; components: TaxInput[] })[];
};
