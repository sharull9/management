"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { Option } from "@/components/shared/combobox/combobox";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import { RowDeleteMenu } from "@/components/shared/row-delete-menu";
import { removeMemberAction } from "../../server/member-actions";
import { MemberForm } from "./member-form";
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
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <SideSheet
            title={`Edit access · ${row.original.name}`}
            trigger="Edit access"
            triggerVariant="outline"
            triggerSize="sm"
          >
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
          </SideSheet>
          <RowDeleteMenu
            rowLabel={row.original.name}
            itemLabel="Remove member"
            title={`Remove ${row.original.name}?`}
            description="They lose access to this organization. Their past records are kept."
            run={() => removeMemberAction(org, { id: row.original.id })}
          />
        </div>
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
