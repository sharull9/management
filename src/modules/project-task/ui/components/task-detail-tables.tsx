"use client";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";

import { TaskUnassignForm } from "./task-work-forms";
export type AssignmentRow = {
  id: string;
  workerId: string;
  worker: string;
  dates: string;
};
export function AssignmentsTable({
  org,
  projectId,
  taskId,
  data,
  canRemove,
}: {
  org: string;
  projectId: string;
  taskId: string;
  data: AssignmentRow[];
  canRemove: boolean;
}) {
  const columns: ColumnDef<AssignmentRow>[] = [
    {
      accessorKey: "worker",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Worker" />
      ),
    },
    { accessorKey: "dates", header: "Dates" },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) =>
        canRemove ? (
          <TaskUnassignForm
            org={org}
            projectId={projectId}
            taskId={taskId}
            workerId={row.original.workerId}
          />
        ) : (
          "—"
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search assigned workers…"
      emptyState={{ title: "No workers assigned." }}
    />
  );
}
export type TaskSummaryRow = {
  id: string;
  priority: string;
  due: string;
  actualStart: string;
  completed: string;
  progress: string;
  estimatedHours: string;
};
const summaryColumns: ColumnDef<TaskSummaryRow>[] = [
  { accessorKey: "priority", header: "Priority" },
  { accessorKey: "due", header: "Due" },
  { accessorKey: "actualStart", header: "Actual start" },
  { accessorKey: "completed", header: "Completed" },
  { accessorKey: "progress", header: "Progress" },
  { accessorKey: "estimatedHours", header: "Estimated hours" },
];
export function TaskSummaryTable({ data }: { data: TaskSummaryRow[] }) {
  return (
    <DataTable columns={summaryColumns} data={data} getRowId={(r) => r.id} />
  );
}
export type TaskHistoryRow = {
  id: string;
  when: string;
  action: string;
  actor: string;
};
const historyColumns: ColumnDef<TaskHistoryRow>[] = [
  {
    accessorKey: "when",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="When" />
    ),
  },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "actor", header: "Actor" },
];
export function TaskHistoryTable({ data }: { data: TaskHistoryRow[] }) {
  return (
    <DataTable
      columns={historyColumns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search task history…"
      emptyState={{ title: "No task history." }}
    />
  );
}
