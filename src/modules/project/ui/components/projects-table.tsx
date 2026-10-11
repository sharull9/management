"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
export type ProjectRow = {
  id: string;
  code: string;
  name: string;
  client: string;
  manager: string;
  dates: string;
  status: string;
  budget: string;
  spent: string;
  used: string;
};
const columns: ColumnDef<ProjectRow>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  { accessorKey: "client", header: "Client" },
  { accessorKey: "manager", header: "Manager" },
  { accessorKey: "dates", header: "Dates" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  { accessorKey: "budget", header: "Budget" },
  { accessorKey: "spent", header: "Spent" },
  { accessorKey: "used", header: "Used" },
];
export function ProjectsTable({
  toolbar,
  org,
  data,
}: {
  toolbar?: ReactNode;
  org: string;
  data: ProjectRow[];
}) {
  return (
    <DataTable
      toolbar={toolbar}
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      rowHref={(row) => `/${org}/projects/${row.id}`}
      emptyState={{ title: "No projects found." }}
    />
  );
}
