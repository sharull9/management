"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";

export type PartyListRow = {
  id: string;
  code: string;
  name: string;
  isVendor: boolean;
  isCustomer: boolean;
  defaultCurrency: string;
  taxId: string;
  location: string;
  contact: string;
};

export function PartiesTable({
  org,
  parties,
}: {
  org: string;
  parties: PartyListRow[];
}) {
  const columns: ColumnDef<PartyListRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.code}</span>
      ),
    },
    {
      id: "role",
      header: "Role",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1.5">
          {row.original.isVendor && (
            <StatusBadge status="VENDOR" label="Vendor" tone="blue" />
          )}
          {row.original.isCustomer && (
            <StatusBadge status="CUSTOMER" label="Customer" tone="teal" />
          )}
          {!row.original.isVendor && !row.original.isCustomer && "—"}
        </div>
      ),
    },
    {
      accessorKey: "defaultCurrency",
      header: "Currency",
      cell: ({ row }) =>
        row.original.defaultCurrency ? (
          <span className="font-mono text-xs">
            {row.original.defaultCurrency}
          </span>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "taxId",
      header: "Tax ID",
      cell: ({ row }) =>
        row.original.taxId ? (
          <span className="font-mono text-xs">{row.original.taxId}</span>
        ) : (
          "—"
        ),
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="City / State" />
      ),
      cell: ({ row }) => row.original.location || "—",
    },
    {
      accessorKey: "contact",
      header: "Phone / Email",
      cell: ({ row }) => row.original.contact || "—",
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={parties}
      getRowId={(party) => party.id}
      searchPlaceholder="Search parties…"
      rowHref={(party) => `/${org}/masters/parties/${party.id}`}
      emptyState={{
        title: "No parties yet.",
        description: "Add a vendor or customer to get started.",
      }}
    />
  );
}
