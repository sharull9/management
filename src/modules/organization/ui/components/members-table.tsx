"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { Option } from "@/components/shared/combobox";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { removeMemberAction } from "../../server/member-actions";
import { MemberForm } from "./member-form";
import { RecordDeleteForm } from "./record-delete-form";
export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  roleId: string | null;
  customRole: string | null;
};
export function MembersTable({
  org,
  data,
  roles,
}: {
  org: string;
  data: MemberRow[];
  roles: Option[];
}) {
  const columns: ColumnDef<MemberRow>[] = [
    {
      id: "member",
      accessorFn: (row) => `${row.name} ${row.email}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Member" />
      ),
      cell: ({ row }) => (
        <>
          {row.original.name}
          <span className="block text-xs text-muted-foreground">
            {row.original.email}
          </span>
        </>
      ),
    },
    { accessorKey: "role", header: "Base role" },
    {
      accessorKey: "customRole",
      header: "Custom role",
      cell: ({ row }) => row.original.customRole ?? "None",
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <details>
          <summary className="cursor-pointer text-sm">Edit access</summary>
          <div className="min-w-56 space-y-4 pt-4">
            <MemberForm
              org={org}
              customRoles={roles}
              member={{
                email: row.original.email,
                name: row.original.name,
                password: "",
                role: row.original.role,
                roleId: row.original.roleId,
              }}
            />
            <RecordDeleteForm
              id={row.original.id}
              action={removeMemberAction.bind(null, org)}
              submit="Remove member"
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
      searchPlaceholder="Search members..."
      emptyState={{ title: "No organization members yet." }}
    />
  );
}
