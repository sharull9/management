import type { Decimal } from "@/core/decimal";
import type { AccountType, JournalStatus } from "@/generated/prisma/client";

export type DecimalValue = InstanceType<typeof Decimal>;
export type { AccountType, JournalStatus };

export type JournalLineInput = {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
  projectId: string | null;
  partyId: string | null;
};

export type JournalLineSnapshot = {
  debit: string | DecimalValue;
  credit: string | DecimalValue;
  projectId?: string | null;
  partyId?: string | null;
  taxComponentId?: string | null;
  taxName?: string | null;
  taxRate?: string | DecimalValue | null;
  taxBaseAmount?: string | DecimalValue | null;
  [key: string]: unknown;
};
