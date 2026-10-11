"use client";
import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { Badge } from "@/components/ui/badge";
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
    cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
  },
  { accessorKey: "budget", header: "Budget" },
  { accessorKey: "spent", header: "Spent" },
  { accessorKey: "used", header: "Used" },
];
export function ProjectsTable({
  org,
  data,
}: {
  org: string;
  data: ProjectRow[];
}) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      rowHref={(row) => `/${org}/projects/${row.id}`}
      searchPlaceholder="Search projects..."
      emptyState={{ title: "No projects found." }}
    />
  );
}
