"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import type { budgetLineInput } from "../../schema";
import { BudgetLineForm, DeleteBudgetForm } from "./budget-forms";
export type BudgetRow = {
  id: string;
  costType: string;
  stage: string;
  amount: string;
  actual: string;
  remaining: string;
};
export type BudgetLineRow = BudgetRow & z.input<typeof budgetLineInput>;
const baseColumns: ColumnDef<BudgetRow>[] = [
  {
    accessorKey: "costType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
  },
  { accessorKey: "stage", header: "Stage" },
  { accessorKey: "amount", header: "Budget" },
  { accessorKey: "actual", header: "Actual" },
  { accessorKey: "remaining", header: "Remaining" },
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
    },
    { accessorKey: "stage", header: "Stage" },
    { accessorKey: "amount", header: "Budget" },
    { accessorKey: "actual", header: "Actual for type/stage" },
    { accessorKey: "remaining", header: "Remaining vs line" },
    { accessorKey: "note", header: "Note" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) =>
        manage ? (
          <div className="space-y-4">
            <details>
              <summary className="cursor-pointer">Edit line</summary>
              <BudgetLineForm
                org={org}
                projectId={projectId}
                line={row.original}
                stages={stages}
              />
            </details>
            <DeleteBudgetForm
              org={org}
              projectId={projectId}
              id={row.original.id}
            />
          </div>
        ) : (
          "\u2014"
        ),
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
