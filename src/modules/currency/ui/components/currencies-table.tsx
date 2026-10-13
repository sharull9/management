"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { setTenantCurrencyAction } from "../../server/actions";

export type CurrencyListRow = {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  enabled: boolean;
  isBase: boolean;
};

function EnabledToggle({
  org,
  row,
  canManage,
}: {
  org: string;
  row: CurrencyListRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const change = (enabled: boolean) =>
    startTransition(async () => {
      const result = await setTenantCurrencyAction(org, {
        currencyCode: row.code,
        enabled,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${row.code} ${enabled ? "enabled" : "disabled"}.`);
      router.refresh();
    });
  return (
    <Checkbox
      checked={row.enabled}
      disabled={!canManage || pending || row.isBase}
      aria-label={`${row.enabled ? "Disable" : "Enable"} ${row.code}`}
      onCheckedChange={(checked) => change(checked === true)}
    />
  );
}

export function CurrenciesTable({
  org,
  currencies,
  canManage,
}: {
  org: string;
  currencies: CurrencyListRow[];
  canManage: boolean;
}) {
  const columns: ColumnDef<CurrencyListRow>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-mono text-xs">
          {row.original.code}
          {row.original.isBase && (
            <StatusBadge status="BASE" label="Base" tone="blue" />
          )}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },
    { accessorKey: "symbol", header: "Symbol", enableSorting: false },
    {
      accessorKey: "decimals",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Decimals" />
      ),
    },
    {
      id: "enabled",
      header: "Enabled",
      enableSorting: false,
      cell: ({ row }) => (
        <EnabledToggle org={org} row={row.original} canManage={canManage} />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={currencies}
      getRowId={(currency) => currency.code}
      searchPlaceholder="Search currencies…"
      emptyState={{
        title: "No currencies yet.",
        description: "Add a currency from the master list.",
      }}
    />
  );
}
