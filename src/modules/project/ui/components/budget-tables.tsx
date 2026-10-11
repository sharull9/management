"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Separator } from "@/components/ui/separator";
import { formatMoney } from "@/core/format";
import type { budgetLineInput } from "../../schema";
import { BudgetLineForm, DeleteBudgetForm } from "./budget-forms";
export type BudgetRow = {
  id: string;
  costType: string;
  stage: string;
  amount: string;
  actual: string;
  remaining: string;
  currency: string;
};
export type BudgetLineRow = BudgetRow & z.input<typeof budgetLineInput>;
const baseColumns: ColumnDef<BudgetRow>[] = [
  {
    accessorKey: "costType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <StatusBadge status={row.original.costType} tone="neutral" />
    ),
  },
  { accessorKey: "stage", header: "Stage" },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Budget</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatMoney(row.original.amount, row.original.currency)}
      </div>
    ),
  },
  {
    accessorKey: "actual",
    header: () => <div className="text-right">Actual</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatMoney(row.original.actual, row.original.currency)}
      </div>
    ),
  },
  {
    accessorKey: "remaining",
    header: () => <div className="text-right">Remaining</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {formatMoney(row.original.remaining, row.original.currency)}
      </div>
    ),
  },
];
export function BudgetSummaryTable({ data }: { data: BudgetRow[] }) {
  return (
    <DataTable
      columns={baseColumns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search budget totals..."
      emptyState={{ title: "No budget totals yet." }}
    />
  );
}
export function BudgetLinesTable({
  org,
  projectId,
  data,
  stages,
  manage,
}: {
  org: string;
  projectId: string;
  data: BudgetLineRow[];
  stages: { id: string; name: string }[];
  manage: boolean;
}) {
  const columns: ColumnDef<BudgetLineRow>[] = [
    {
      accessorKey: "costType",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.costType} tone="neutral" />
      ),
    },
    { accessorKey: "stage", header: "Stage" },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Budget</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatMoney(row.original.amount, row.original.currency)}
        </div>
      ),
    },
    {
      accessorKey: "actual",
      header: () => <div className="text-right">Actual for type/stage</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatMoney(row.original.actual, row.original.currency)}
        </div>
      ),
    },
    {
      accessorKey: "remaining",
      header: () => <div className="text-right">Remaining vs line</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {formatMoney(row.original.remaining, row.original.currency)}
        </div>
      ),
    },
    {
      accessorKey: "note",
      header: "Note",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.note}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        manage ? (
          <SideSheet
            title="Edit budget line"
            description={`${row.original.costType} \u00b7 ${row.original.stage}`}
            trigger="Edit"
            triggerVariant="outline"
            triggerSize="sm"
          >
            <div className="space-y-6">
              <BudgetLineForm
                org={org}
                projectId={projectId}
                line={row.original}
                stages={stages}
              />
              <Separator />
              <DeleteBudgetForm
                org={org}
                projectId={projectId}
                id={row.original.id}
              />
            </div>
          </SideSheet>
        ) : null,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search budget lines..."
      emptyState={{ title: "No budget lines yet." }}
    />
  );
}
