"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";

export type TaskRow = {
  id: string;
  task: string;
  stage: string;
  priority: string;
  status: string;
  due: string;
  progress: string;
};
const columns: ColumnDef<TaskRow>[] = [
  {
    accessorKey: "task",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Task" />
    ),
  },
  {
    accessorKey: "stage",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stage" />
    ),
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.priority}
        tone={
          row.original.priority === "URGENT"
            ? "red"
            : row.original.priority === "HIGH"
              ? "amber"
              : "neutral"
        }
      />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  { accessorKey: "due", header: "Due" },
  { accessorKey: "progress", header: "Progress" },
];
export function TasksTable({
  org,
  projectId,
  data,
  toolbar,
}: {
  org: string;
  projectId: string;
  data: TaskRow[];
  toolbar?: ReactNode;
}) {
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={data}
      pageSize={20}
      getRowId={(r) => r.id}
      rowHref={(r) => `/${org}/projects/${projectId}/tasks/${r.id}`}
      emptyState={{ title: "No tasks." }}
    />
  );
}
