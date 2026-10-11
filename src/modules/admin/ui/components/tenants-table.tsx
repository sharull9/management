"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, MoreHorizontal, Pause, Play } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TenantStatusDialog } from "./tenant-forms";
import { TenantStatusBadge } from "./tenant-status-badge";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  memberCount: number;
  owners: { id: string; name: string; email: string }[];
  organizations: {
    id: string;
    name: string;
    slug: string;
    baseCurrency: string;
  }[];
};

function OrganizationsCell({ row }: { row: TenantRow }) {
  const count = row.organizations.length;
  if (!count)
    return <span className="text-sm text-muted-foreground">Not set up</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2">
          <Building2 data-icon="inline-start" />
          {count} {count === 1 ? "organization" : "organizations"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <ul className="space-y-1">
          {row.organizations.map((org) => (
            <li key={org.id} className="rounded-md px-2 py-1.5">
              <p className="text-sm font-medium">{org.name}</p>
              <p className="text-xs text-muted-foreground">
                /{org.slug}, {org.baseCurrency}
              </p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function RowActions({ row }: { row: TenantRow }) {
  const [confirming, setConfirming] = useState(false);
  const active = row.status === "ACTIVE";
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${row.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant={active ? "destructive" : "default"}
            onSelect={() => setConfirming(true)}
          >
            {active ? <Pause /> : <Play />}
            {active ? "Suspend tenant" : "Reactivate tenant"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TenantStatusDialog
        key={row.status}
        tenant={row}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </>
  );
}

const columns: ColumnDef<TenantRow>[] = [
  {
    id: "tenant",
    accessorFn: (row) => `${row.name} ${row.slug}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tenant" />
    ),
    cell: ({ row }) => (
      <div className="min-w-40">
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.slug}</p>
      </div>
    ),
  },
  {
    id: "owners",
    accessorFn: (row) =>
      row.owners.map((owner) => `${owner.name} ${owner.email}`).join(" "),
    header: "Owner",
    cell: ({ row }) =>
      row.original.owners.length ? (
        row.original.owners.map((owner) => (
          <div key={owner.id}>
            <p>{owner.name}</p>
            <p className="text-xs text-muted-foreground">{owner.email}</p>
          </div>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">No owner</span>
      ),
  },
  {
    id: "status",
    accessorFn: (row) => (row.status === "ACTIVE" ? "Active" : "Suspended"),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
  },
  {
    id: "organizations",
    accessorFn: (row) =>
      row.organizations.map((org) => `${org.name} ${org.slug}`).join(" "),
    header: "Organizations",
    cell: ({ row }) => <OrganizationsCell row={row.original} />,
  },
  {
    accessorKey: "memberCount",
    header: "Members",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.memberCount}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-sm whitespace-nowrap text-muted-foreground">
        {row.original.createdAt}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <RowActions row={row.original} />
      </div>
    ),
  },
];

export function TenantsTable({ data }: { data: TenantRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search by tenant, owner or organization"
      emptyState={{
        icon: <Building2 />,
        title: "No tenants yet",
        description: "Create the first tenant to give a customer access.",
      }}
    />
  );
}
