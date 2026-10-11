"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { statusLabel } from "@/components/shared/status-badge-tone";

export type TaxGroupListRow = {
  id: string;
  name: string;
  country: string;
  scope: string;
  components: string;
  totalRate: string;
};

export function TaxGroupsTable({
  org,
  groups,
}: {
  org: string;
  groups: TaxGroupListRow[];
}) {
  const columns: ColumnDef<TaxGroupListRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    {
      accessorKey: "country",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Country" />
      ),
      cell: ({ row }) => row.original.country || "—",
    },
    { accessorKey: "scope", header: "Scope" },
    {
      accessorKey: "components",
      header: "Components",
      cell: ({ row }) => row.original.components || "—",
    },
    {
      accessorKey: "totalRate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total rate" />
      ),
      cell: ({ row }) => `${row.original.totalRate}%`,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={groups}
      getRowId={(g) => g.id}
      searchPlaceholder="Search tax groups…"
      rowHref={(g) => `/${org}/masters/tax/groups/${g.id}`}
      emptyState={{
        title: "No tax groups yet.",
        description: "Combine tax components into a group to apply to items.",
      }}
    />
  );
}

export type TaxComponentListRow = {
  id: string;
  name: string;
  code: string;
  rate: string;
  appliesTo: string;
  isWithholding: boolean;
};

export function TaxComponentsTable({
  org,
  components,
}: {
  org: string;
  components: TaxComponentListRow[];
}) {
  const columns: ColumnDef<TaxComponentListRow>[] = [
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
      accessorKey: "rate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Rate" />
      ),
      cell: ({ row }) => `${row.original.rate}%`,
    },
    {
      accessorKey: "appliesTo",
      header: "Applies to",
      cell: ({ row }) => <span>{statusLabel(row.original.appliesTo)}</span>,
    },
    {
      accessorKey: "isWithholding",
      header: "Type",
      cell: ({ row }) => (row.original.isWithholding ? "Withholding" : "Tax"),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={components}
      getRowId={(c) => c.id}
      searchPlaceholder="Search tax components…"
      rowHref={(c) => `/${org}/masters/tax/components/${c.id}`}
      emptyState={{
        title: "No tax components yet.",
        description: "Create a component such as CGST or TDS.",
      }}
    />
  );
}
