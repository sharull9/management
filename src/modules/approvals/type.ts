import type { z } from "zod";
import type { Option } from "@/components/shared/combobox";
import type { savePolicyInput } from "./schema";

export type PolicyDraft = z.input<typeof savePolicyInput>;
export type PolicyOptions = {
  roles: Option[];
  users: Option[];
  projects: Option[];
  stages: Option[];
};
export type PolicyRow = {
  id: string;
  name: string;
  documentType: string;
  active: boolean;
  scope: string;
  stepCount: number;
  updatedAt: string;
  draft: PolicyDraft;
  options: PolicyOptions;
};
export type PendingRow = {
  id: string;
  title: string;
  href: string;
  documentType: string;
  stepName: string;
  requestedBy: string;
  amount: string | null;
  createdAt: string;
};
export type HistoryRow = {
  id: string;
  title: string;
  href: string;
  documentType: string;
  status: string;
  requestedBy: string;
  createdAt: string;
  canCancel: boolean;
  steps: {
    id: string;
    sequence: number;
    name: string;
    status: string;
    actedBy: string | null;
    comment: string | null;
  }[];
};

export type TimelineRequest = {
  id: string;
  status: string;
  createdAt: Date;
  steps: {
    id: string;
    sequence: number;
    name: string;
    status: string;
    actedBy: { name: string } | null;
    comment: string | null;
  }[];
};
export type TimelineProps = {
  org: string;
  approvals: TimelineRequest[];
  variant: "procurement" | "bill" | "payment" | "sales";
};
