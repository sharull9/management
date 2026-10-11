"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { TenantStatusForm } from "./tenant-forms";
export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  owners: { id: string; name: string; email: string }[];
  organizations: {
    id: string;
    name: string;
    slug: string;
    baseCurrency: string;
  }[];
};
export function TenantsTable({ data }: { data: TenantRow[] }) {
  const columns: ColumnDef<TenantRow>[] = [
    {
      id: "tenant",
      accessorFn: (row) => `${row.name} ${row.slug}`,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tenant" />
      ),
      cell: ({ row }) => (
        <>
          <p className="font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.slug}</p>
        </>
      ),
    },
    {
      id: "owners",
      accessorFn: (row) =>
        row.owners.map((owner) => `${owner.name} ${owner.email}`).join(" "),
      header: "Owner",
      cell: ({ row }) =>
        row.original.owners.map((owner) => (
          <p key={owner.id}>
            {owner.name}
            <span className="block text-xs text-muted-foreground">
              {owner.email}
            </span>
          </p>
        )),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "ACTIVE" ? "secondary" : "destructive"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "organizations",
      accessorFn: (row) =>
        row.organizations.map((org) => `${org.name} ${org.slug}`).join(" "),
      header: "Organizations",
      cell: ({ row }) => (
        <details>
          <summary className="cursor-pointer">
            {row.original.organizations.length} organizations
          </summary>
          {row.original.organizations.length ? (
            <ItemGroup className="mt-2">
              {row.original.organizations.map((org) => (
                <Item key={org.id}>
                  <ItemContent>
                    <ItemTitle>{org.name}</ItemTitle>
                    <ItemDescription>
                      /{org.slug} &middot; {org.baseCurrency}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          ) : (
            <EmptyState title="No organizations yet." />
          )}
        </details>
      ),
    },
    {
      id: "access",
      header: "Access",
      cell: ({ row }) => (
        <TenantStatusForm
          key={`${row.original.id}-${row.original.status}`}
          tenantId={row.original.id}
          status={row.original.status}
        />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search tenants..."
      emptyState={{
        title: "No tenants yet.",
        description: "Create the first tenant below.",
      }}
    />
  );
}
