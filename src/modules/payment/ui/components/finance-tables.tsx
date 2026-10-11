"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Decimal } from "../../server/allocation";
export type FinanceRow = {
  id: string;
  code: string;
  date: string;
  party: string;
  project: string;
  status: string;
  currency: string;
  amount: string;
  allocation: string;
  direction: string;
};
const financeColumns: ColumnDef<FinanceRow>[] = [
  { accessorKey: "code", header: "Document" },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => row.original.date.slice(0, 10),
  },
  {
    accessorKey: "party",
    header: "Party",
    cell: ({ row }) => (
      <>
        {row.original.party}
        <p className="text-xs text-muted-foreground">
          {row.original.direction}
        </p>
      </>
    ),
  },
  { accessorKey: "project", header: "Project" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    sortingFn: (a, b) => new Decimal(a.original.amount).cmp(b.original.amount),
    cell: ({ row }) => `${row.original.currency} ${row.original.amount}`,
  },
  { accessorKey: "allocation", header: "Allocation" },
];
export function FinanceTable({
  org,
  requests,
  data,
}: {
  org: string;
  requests: boolean;
  data: FinanceRow[];
}) {
  return (
    <DataTable
      columns={financeColumns}
      data={data}
      searchPlaceholder="Search documents, parties or projects..."
      getRowId={(r) => r.id}
      rowHref={(r) =>
        `/${org}/finance/${requests ? "payment-requests" : "payments"}/${r.id}`
      }
      emptyState={{ title: "No records yet." }}
    />
  );
}
export type BalanceRow = {
  id: string;
  partyId: string;
  party: string;
  type: string;
  currency: string;
  billed: string;
  paid: string;
  payable: string;
  invoiced: string;
  received: string;
  receivable: string;
  outgoingAdvance: string;
  incomingAdvance: string;
  net: string;
};
const balanceAmounts = {
  billed: "Billed",
  paid: "Paid",
  payable: "Payable",
  invoiced: "Invoiced",
  received: "Received",
  receivable: "Receivable",
  outgoingAdvance: "Vendor advance",
  incomingAdvance: "Customer advance",
  net: "Net",
} as const;
const balanceColumns: ColumnDef<BalanceRow>[] = [
  {
    accessorKey: "party",
    header: "Party",
    cell: ({ row }) => (
      <>
        {row.original.party}
        <p className="text-xs text-muted-foreground">{row.original.type}</p>
      </>
    ),
  },
  { accessorKey: "currency", header: "Currency" },
  ...Object.entries(balanceAmounts).map(
    ([key, title]): ColumnDef<BalanceRow> => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={title} />
      ),
      sortingFn: (a, b) =>
        new Decimal(a.getValue<string>(key)).cmp(b.getValue<string>(key)),
    }),
  ),
];
export function BalancesTable({
  org,
  projectId,
  data,
}: {
  org: string;
  projectId?: string;
  data: BalanceRow[];
}) {
  return (
    <DataTable
      columns={balanceColumns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search party balances..."
      rowHref={(r) =>
        `/${org}/finance/balances/${r.partyId}?${new URLSearchParams({ currency: r.currency, ...(projectId ? { projectId } : {}) })}`
      }
      emptyState={{ title: "No approved documents or posted payments." }}
    />
  );
}
export type AgingRow = {
  id: string;
  party: string;
  side: string;
  current: string;
  "0\u201330": string;
  "31\u201360": string;
  "61\u201390": string;
  "90+": string;
};
const agingColumns: ColumnDef<AgingRow>[] = [
  { accessorKey: "party", header: "Party / currency" },
  { accessorKey: "side", header: "Side" },
  ...["current", "0\u201330", "31\u201360", "61\u201390", "90+"].map(
    (key): ColumnDef<AgingRow> => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={key === "current" ? "Current" : key}
        />
      ),
      sortingFn: (a, b) =>
        new Decimal(a.getValue<string>(key)).cmp(b.getValue<string>(key)),
    }),
  ),
];
export function AgingTable({ data }: { data: AgingRow[] }) {
  return (
    <DataTable
      columns={agingColumns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search aging by party or side..."
      emptyState={{ title: "No outstanding aging." }}
    />
  );
}
export type StatementRow = {
  id: string;
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};
const statementColumns: ColumnDef<StatementRow>[] = (
  [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => row.original.date.slice(0, 10),
    },
    { accessorKey: "description", header: "Activity" },
    { accessorKey: "debit", header: "Debit" },
    { accessorKey: "credit", header: "Credit" },
    { accessorKey: "balance", header: "Running balance" },
  ] satisfies ColumnDef<StatementRow>[]
).map((column) => ({ ...column, enableSorting: false }));
export function StatementTable({ data }: { data: StatementRow[] }) {
  return (
    <DataTable
      columns={statementColumns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search statement activity..."
      emptyState={{ title: "No activity." }}
    />
  );
}
