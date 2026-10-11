"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import type { workerInput } from "../../schema";
import { RemoveMemberForm, RemoveWorkerForm, WorkerForm } from "./team-forms";

type MemberRow = {
  id: string;
  userId: string;
  name: string;
  role: string;
  manager: string;
};
type WorkerRow = z.input<typeof workerInput> & {
  workerId: string;
  id: string;
  name: string;
  availability: string;
};
export function MembersTable({
  org,
  projectId,
  data,
  manage,
}: {
  org: string;
  projectId: string;
  data: MemberRow[];
  manage: boolean;
}) {
  const columns: ColumnDef<MemberRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Member" />
      ),
    },
    { accessorKey: "role", header: "Role" },
    { accessorKey: "manager", header: "Manager" },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) =>
        manage ? (
          <RemoveMemberForm
            org={org}
            projectId={projectId}
            userId={row.original.userId}
          />
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
      searchPlaceholder="Search members..."
      emptyState={{ title: "No project members yet." }}
    />
  );
}
export function WorkersTable({
  org,
  projectId,
  data,
  manage,
}: {
  org: string;
  projectId: string;
  data: WorkerRow[];
  manage: boolean;
}) {
  const columns: ColumnDef<WorkerRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Worker" />
      ),
    },
    {
      id: "dates",
      accessorFn: (row) => `${row.startDate} / ${row.endDate || "Open"}`,
      header: "Start / end",
    },
    {
      accessorKey: "dayRateOverride",
      header: "Day rate",
      cell: ({ row }) => row.original.dayRateOverride || "Worker pay terms",
    },
    {
      accessorKey: "otHourlyRateOverride",
      header: "OT hourly rate",
      cell: ({ row }) =>
        row.original.otHourlyRateOverride || "Worker pay terms",
    },
    { accessorKey: "availability", header: "Availability" },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) =>
        manage ? (
          <div className="space-y-4">
            <details>
              <summary className="cursor-pointer">Edit assignment</summary>
              <WorkerForm
                org={org}
                projectId={projectId}
                assignment={row.original}
                workers={[
                  { id: row.original.workerId, name: row.original.name },
                ]}
              />
            </details>
            <RemoveWorkerForm
              org={org}
              projectId={projectId}
              id={row.original.id}
              workerId={row.original.workerId}
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
      searchPlaceholder="Search worker assignments..."
      emptyState={{ title: "No worker assignments yet." }}
    />
  );
}
