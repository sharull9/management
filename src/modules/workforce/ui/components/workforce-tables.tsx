"use client";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { z } from "zod";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
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
}: {
  org: string;
  data: WorkerRow[];
  designations: { id: string; name: string }[];
  manage: boolean;
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
    { accessorKey: "active", header: "Active" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) =>
        manage ? (
          <details>
            <summary className="cursor-pointer">Edit worker</summary>
            <div className="min-w-64 pt-4">
              <WorkerForm
                org={org}
                worker={row.original.edit}
                designations={designations}
              />
            </div>
          </details>
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
      searchPlaceholder="Search workers…"
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
}: {
  org: string;
  data: AvailabilityRow[];
}) {
  const columns: ColumnDef<AvailabilityRow>[] = [
    {
      accessorKey: "worker",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Worker" />
      ),
    },
    { accessorKey: "availability", header: "Availability" },
    {
      id: "projects",
      header: "Current / upcoming projects",
      cell: ({ row }) =>
        row.original.projects.length ? (
          <ItemGroup>
            {row.original.projects.map((p) => (
              <Item key={p.id}>
                <ItemContent>
                  <ItemTitle>
                    <Link
                      className="underline"
                      href={`/${org}/projects/${p.projectId}`}
                    >
                      {p.name}
                    </Link>
                  </ItemTitle>
                  <ItemDescription>
                    {p.start} to {p.end || "Open"}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <EmptyState title="No current or upcoming projects." />
        ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(r) => r.id}
      searchPlaceholder="Search availability…"
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
      header: "Actions",
      cell: ({ row }) => (
        <div className="space-y-4">
          <DesignationForm org={org} designation={row.original} />
          <DesignationForm org={org} designation={row.original} remove />
        </div>
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
