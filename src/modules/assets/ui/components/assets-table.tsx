"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import {
  FilterBar,
  FilterSelect,
} from "@/components/shared/filter-bar/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PageInfo } from "@/core/pagination";

export type AssetRow = {
  id: string;
  name: string;
  code: string;
  type: string;
  meterType: string;
  powerType: string;
  active: boolean;
  equipmentRatePerMeter: string;
  projectNames: string;
};

const columns: ColumnDef<AssetRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Asset" />
    ),
    cell: ({ row }) => (
      <span>
        {row.original.name}{" "}
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {row.original.code}
        </span>
      </span>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) =>
      `${row.original.type === "MACHINE" ? "Machine" : "Vehicle"} · ${row.original.powerType.toLowerCase()}`,
  },
  {
    accessorKey: "meterType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Meter" />
    ),
    cell: ({ row }) =>
      row.original.meterType === "KM" ? "Kilometres" : "Hours",
  },
  {
    accessorKey: "projectNames",
    header: "Allocated to",
    cell: ({ row }) => row.original.projectNames || "Unallocated",
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge status={row.original.active ? "ACTIVE" : "INACTIVE"} />
    ),
  },
];

export function AssetsTable({
  data,
  org,
  projectId,
  serverPage,
}: {
  data: AssetRow[];
  org: string;
  projectId?: string;
  serverPage: PageInfo;
}) {
  return (
    <DataTable
      columns={columns}
      data={data}
      serverPage={serverPage}
      getRowId={(row) => row.id}
      rowHref={(row) =>
        `/${org}/assets/${row.id}${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`
      }
      searchPlaceholder="Search assets…"
      emptyState={{
        title: "No assets match these filters.",
        description: "Try changing the filters or add an asset.",
      }}
      toolbar={
        <FilterBar>
          <FilterSelect
            name="type"
            label="Type"
            options={[
              { value: "VEHICLE", label: "Vehicle" },
              { value: "MACHINE", label: "Machine" },
            ]}
          />
          <FilterSelect
            name="status"
            label="Status"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </FilterBar>
      }
    />
  );
}
