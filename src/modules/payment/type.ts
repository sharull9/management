export type Document = {
  id: string;
  code: string;
  partyId: string;
  projectId: string | null;
  currency: string;
  outstanding: string;
};
export type Request = {
  id: string;
  code: string;
  partyId: string;
  projectId: string | null;
  currency: string;
  mode: string;
  remaining: string;
};
export type FormData = {
  projects: { id: string; name: string; currency: string }[];
  parties: {
    id: string;
    name: string;
    isVendor: boolean;
    isCustomer: boolean;
  }[];
  bills: Document[];
  requests: Request[];
  baseCurrency: string;
  allowOrganization: boolean;
};
export type RequestDraft = {
  id: string;
  partyId: string;
  projectId: string | null;
  date: string;
  currency: string;
  exchangeRate: string;
  amount: string;
  mode: string;
  purpose: string;
  reason: string;
  allocations: { documentId: string; amount: string; code?: string }[];
};
