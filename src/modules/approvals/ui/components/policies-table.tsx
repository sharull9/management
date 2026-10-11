"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { Badge } from "@/components/ui/badge";
import type { PolicyRow } from "../../type";
import { PolicyEditor } from "./policy-editor";

export function PoliciesTable({
  org,
  data,
}: {
  org: string;
  data: PolicyRow[];
}) {
  const columns: ColumnDef<PolicyRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Policy" />
      ),
    },
    { accessorKey: "documentType", header: "Document type" },
    { accessorKey: "scope", header: "Scope" },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    { accessorKey: "stepCount", header: "Steps" },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Updated" />
      ),
      cell: ({ row }) =>
        new Date(row.original.updatedAt).toLocaleDateString("en-IN"),
    },
    {
      id: "edit",
      header: "Edit",
      cell: ({ row }) => (
        <details className="min-w-64">
          <summary className="cursor-pointer text-sm">Edit policy</summary>
          <div className="pt-6">
            <PolicyEditor
              org={org}
              draft={row.original.draft}
              options={row.original.options}
            />
          </div>
        </details>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search policies"
      emptyState={{
        title: "No approval policies yet.",
        description: "Create a policy below.",
      }}
    />
  );
}
