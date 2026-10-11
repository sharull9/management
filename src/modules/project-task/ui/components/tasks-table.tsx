"use client";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";

import { Badge } from "@/components/ui/badge";
export type TaskRow = {
  id: string;
  task: string;
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
  { accessorKey: "priority", header: "Priority" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
  },
  { accessorKey: "due", header: "Due" },
  { accessorKey: "progress", header: "Progress" },
];
export function TasksTable({
  org,
  projectId,
  data,
}: {
  org: string;
  projectId: string;
  data: TaskRow[];
}) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search tasks…"
      getRowId={(r) => r.id}
      rowHref={(r) => `/${org}/projects/${projectId}/tasks/${r.id}`}
      emptyState={{ title: "No tasks." }}
    />
  );
}
