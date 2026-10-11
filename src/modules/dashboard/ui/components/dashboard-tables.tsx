"use client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { Progress } from "@/components/ui/progress";
export type ProjectRow = {
  id: string;
  project: string;
  budget: string;
  spent: string;
  usage: string | null;
};
export function DashboardProjectsTable({
  org,
  data,
}: {
  org: string;
  data: ProjectRow[];
}) {
  const columns: ColumnDef<ProjectRow>[] = [
    {
      accessorKey: "project",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
    },
    { accessorKey: "budget", header: "Budget" },
    { accessorKey: "spent", header: "Spent" },
    {
      accessorKey: "usage",
      header: "Budget usage",
      cell: ({ row }) =>
        row.original.usage === null ? (
          "—"
        ) : (
          <div className="flex min-w-40 items-center gap-3">
            <Progress
              value={Math.min(100, Number(row.original.usage))}
              className="w-24 bg-foreground/10"
              aria-label={`${row.original.usage}% of budget used`}
            />
            <span className="w-14 text-right tabular-nums">
              {row.original.usage}%
            </span>
          </div>
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      rowHref={(r) => `/${org}/projects/${r.id}`}
      searchPlaceholder="Search active projects…"
      emptyState={{ title: "No active projects." }}
    />
  );
}
export type OverdueRow = {
  id: string;
  projectId: string;
  project: string;
  task: string;
  due: string;
};
export function OverdueTasksTable({
  org,
  data,
}: {
  org: string;
  data: OverdueRow[];
}) {
  const columns: ColumnDef<OverdueRow>[] = [
    {
      accessorKey: "project",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Project" />
      ),
    },
    {
      accessorKey: "task",
      header: "Task",
      cell: ({ row }) => (
        <Link
          className="underline"
          href={`/${org}/projects/${row.original.projectId}/tasks/${row.original.id}`}
        >
          {row.original.task}
        </Link>
      ),
    },
    { accessorKey: "due", header: "Due" },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search overdue tasks…"
      emptyState={{ title: "No overdue tasks." }}
    />
  );
}
