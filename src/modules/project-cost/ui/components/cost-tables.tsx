"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { type ReactNode, useMemo } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";

export type LedgerRow = {
  id: string;
  date: string;
  type: string;
  stage: string;
  task: string;
  description: string;
  source: string;
  /** Original amount with its currency code. */
  original: string;
  /** Amount in the project currency. */
  amount: string;
};
const ledgerColumns: ColumnDef<LedgerRow>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
  },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "stage", header: "Stage" },
  { accessorKey: "task", header: "Task" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "original", header: "Original" },
  { accessorKey: "amount", header: "Project amount" },
];
export function CostLedgerTable({
  data,
  toolbar,
  currency,
}: {
  data: LedgerRow[];
  toolbar?: ReactNode;
  currency: string;
}) {
  const columns = useMemo(
    () =>
      ledgerColumns.map((column) =>
        "accessorKey" in column && column.accessorKey === "amount"
          ? { ...column, header: `Project amount (${currency})` }
          : column,
      ),
    [currency],
  );
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search cost ledger…"
      emptyState={{ title: "No cost entries." }}
    />
  );
}
export type ExpenseRow = {
  id: string;
  code: string;
  date: string;
  description: string;
  /** Amount in the expense currency. */
  original: string;
  /** Project-currency amount once posted; "—" while the rate is not applied. */
  project: string;
  base: string;
  status: string;
};
const expenseColumns: ColumnDef<ExpenseRow>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
  },
  { accessorKey: "date", header: "Date" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "original", header: "Amount" },
  { accessorKey: "project", header: "Project amount" },
  { accessorKey: "base", header: "Base amount" },
  { accessorKey: "status", header: "Status" },
];
export function ExpensesTable({ data }: { data: ExpenseRow[] }) {
  return (
    <DataTable
      columns={expenseColumns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search expenses…"
      emptyState={{ title: "No expenses." }}
    />
  );
}
