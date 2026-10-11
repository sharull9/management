"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
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
  { accessorKey: "amount", header: "Amount" },
];
export function CostLedgerTable({
  data,
  toolbar,
}: {
  data: LedgerRow[];
  toolbar?: ReactNode;
}) {
  return (
    <DataTable
      toolbar={toolbar}
      columns={ledgerColumns}
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
  amount: string;
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
  { accessorKey: "amount", header: "Amount" },
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
