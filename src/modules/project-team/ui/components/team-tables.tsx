"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { RowDeleteMenu } from "@/components/shared/row-delete-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import type { workerInput } from "../../schema";
import { removeMemberAction, removeWorkerAction } from "../../server/actions";
import { WorkerForm } from "./team-forms";

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
    {
      accessorKey: "manager",
      header: "Manager",
      cell: ({ row }) =>
        row.original.manager === "Yes" ? (
          <StatusBadge status="MANAGER" label="Manager" tone="purple" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "action",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        manage ? (
          <div className="flex justify-end">
            <RowDeleteMenu
              rowLabel={row.original.name}
              itemLabel="Remove member"
              title={`Remove ${row.original.name}?`}
              description="They lose access to this project. Their past records are kept."
              run={() =>
                removeMemberAction(org, projectId, {
                  userId: row.original.userId,
                })
              }
            />
          </div>
        ) : null,
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
    {
      accessorKey: "availability",
      header: "Availability",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.availability}
          tone={row.original.availability === "Available" ? "green" : "amber"}
        />
      ),
    },
    {
      id: "action",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) =>
        manage ? (
          <div className="flex items-center justify-end gap-1">
            <SideSheet
              title={`Assignment · ${row.original.name}`}
              trigger="Edit"
              triggerVariant="outline"
              triggerSize="sm"
            >
              <WorkerForm
                org={org}
                projectId={projectId}
                assignment={row.original}
                workers={[
                  { id: row.original.workerId, name: row.original.name },
                ]}
              />
            </SideSheet>
            <RowDeleteMenu
              rowLabel={row.original.name}
              itemLabel="Remove worker"
              title={`Remove ${row.original.name}?`}
              description="The worker is unassigned from this project. Recorded attendance is kept."
              run={() =>
                removeWorkerAction(org, projectId, {
                  id: row.original.id,
                  workerId: row.original.workerId,
                })
              }
            />
          </div>
        ) : null,
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
