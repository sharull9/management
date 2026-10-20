"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { z } from "zod";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { SideSheet } from "@/components/shared/overlay/side-sheet";
import type { PageInfo } from "@/core/pagination";
import type {
  assetFuelLogInput,
  assetTripInput,
  assetUsageInput,
} from "../../schema";
import type { AssetAllocationOption } from "./asset-log-form-fields";
import { DeleteAssetRecord } from "./delete-asset-record";
import { FuelForm } from "./fuel-form";
import { TripForm } from "./trip-form";
import { UsageForm } from "./usage-form";

type TripEntry = z.input<typeof assetTripInput>;
type UsageEntry = z.input<typeof assetUsageInput>;
type FuelEntry = z.input<typeof assetFuelLogInput>;
export type HistoryRow = {
  id: string;
  date: string;
  project: string;
  reading: string;
  amount: string;
  detail: string;
  formKind?: "TRIP" | "USAGE" | "FUEL";
  entry?: TripEntry | UsageEntry | FuelEntry;
};

function RecordActions({
  row,
  org,
  assetId,
  allocations,
  baseCurrency,
}: {
  row: HistoryRow;
  org: string;
  assetId: string;
  allocations: AssetAllocationOption[];
  baseCurrency: string;
}) {
  if (!row.formKind || !row.entry) return null;
  const edit =
    row.formKind === "TRIP" ? (
      <TripForm
        org={org}
        assetId={assetId}
        allocations={allocations}
        baseCurrency={baseCurrency}
        entry={row.entry as TripEntry}
      />
    ) : row.formKind === "USAGE" ? (
      <UsageForm
        org={org}
        assetId={assetId}
        allocations={allocations}
        baseCurrency={baseCurrency}
        entry={row.entry as UsageEntry}
      />
    ) : (
      <FuelForm
        org={org}
        assetId={assetId}
        allocations={allocations}
        baseCurrency={baseCurrency}
        entry={row.entry as FuelEntry}
      />
    );
  return (
    <div className="flex gap-2">
      <SideSheet
        title={`Edit ${row.formKind.toLowerCase()}`}
        trigger="Edit"
        triggerVariant="outline"
        triggerSize="sm"
      >
        {edit}
      </SideSheet>
      <DeleteAssetRecord org={org} id={row.id} kind={row.formKind} />
    </div>
  );
}

export function AssetHistoryTable({
  rows,
  kind,
  org,
  assetId,
  allocations,
  baseCurrency,
  canEdit,
  serverPage,
}: {
  rows: HistoryRow[];
  kind: string;
  org: string;
  assetId: string;
  allocations: AssetAllocationOption[];
  baseCurrency: string;
  canEdit: boolean;
  serverPage: PageInfo;
}) {
  const columns: ColumnDef<HistoryRow>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
    },
    { accessorKey: "project", header: "Project" },
    { accessorKey: "detail", header: "Details" },
    { accessorKey: "reading", header: "Meter" },
    { accessorKey: "amount", header: "Cost" },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { original: HistoryRow } }) => (
              <RecordActions
                row={row.original}
                org={org}
                assetId={assetId}
                allocations={allocations}
                baseCurrency={baseCurrency}
              />
            ),
          },
        ]
      : []),
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      serverPage={serverPage}
      getRowId={(row) => row.id}
      searchPlaceholder={`Search ${kind.toLowerCase()} history…`}
      emptyState={{ title: `No ${kind.toLowerCase()} history yet.` }}
    />
  );
}
