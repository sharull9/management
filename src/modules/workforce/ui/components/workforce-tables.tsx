"use client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import type { z } from "zod";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Separator } from "@/components/ui/separator";
import type { saveWorkerInput } from "../../schema";
import { DesignationForm } from "./designation-form";
import { WorkerForm } from "./worker-form";
export type WorkerRow = {
  id: string;
  code: string;
  name: string;
  designation: string;
  payType: string;
  salary: string;
  active: string;
  edit: z.input<typeof saveWorkerInput>;
};
export function WorkersTable({
  org,
  data,
  designations,
  manage,
  toolbar,
}: {
  org: string;
  data: WorkerRow[];
  designations: { id: string; name: string }[];
  manage: boolean;
  toolbar?: ReactNode;
}) {
  const columns: ColumnDef<WorkerRow>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
    },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "designation", header: "Designation" },
    { accessorKey: "payType", header: "Pay type" },
    { accessorKey: "salary", header: "Salary" },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.active === "Yes" ? "ACTIVE" : "INACTIVE"}
        />
      ),
    },
    ...(manage
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
              <SideSheet
                title={`Edit ${row.original.name}`}
                description={row.original.code}
                trigger="Edit"
                triggerVariant="outline"
                triggerSize="sm"
              >
                <WorkerForm
                  org={org}
                  worker={row.original.edit}
                  designations={designations}
                />
              </SideSheet>
            ),
          } satisfies ColumnDef<WorkerRow>,
        ]
      : []),
  ];
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      emptyState={{ title: "No workers." }}
    />
  );
}
export type AvailabilityRow = {
  id: string;
  worker: string;
  availability: string;
  projects: {
    id: string;
    projectId: string;
    name: string;
    start: string;
    end: string;
  }[];
};
export function AvailabilityTable({
  org,
  data,
  toolbar,
}: {
  org: string;
  data: AvailabilityRow[];
  toolbar?: ReactNode;
}) {
  const columns: ColumnDef<AvailabilityRow>[] = [
    {
      accessorKey: "worker",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Worker" />
      ),
    },
    {
      accessorKey: "availability",
      header: "Availability",
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.availability}
          tone={
            row.original.availability === "Free"
              ? "green"
              : row.original.availability === "Busy"
                ? "amber"
                : "neutral"
          }
        />
      ),
    },
    {
      id: "projects",
      header: "Current / upcoming projects",
      cell: ({ row }) =>
        row.original.projects.length ? (
          <ul className="space-y-1">
            {row.original.projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-2">
                <Link
                  className="font-medium underline-offset-4 hover:text-primary hover:underline"
                  href={`/${org}/projects/${p.projectId}`}
                >
                  {p.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {p.start} → {p.end || "Open"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      toolbar={toolbar}
      emptyState={{ title: "No workers." }}
    />
  );
}
export function DesignationsTable({
  org,
  data,
}: {
  org: string;
  data: { id: string; name: string }[];
}) {
  const columns: ColumnDef<{ id: string; name: string }>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Designation" />
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <SideSheet
          title={`Edit ${row.original.name}`}
          trigger="Edit"
          triggerVariant="outline"
          triggerSize="sm"
          width="md"
        >
          <div className="space-y-6">
            <DesignationForm org={org} designation={row.original} />
            <Separator />
            <DesignationForm org={org} designation={row.original} remove />
          </div>
        </SideSheet>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search designations…"
      emptyState={{ title: "No designations." }}
    />
  );
}
