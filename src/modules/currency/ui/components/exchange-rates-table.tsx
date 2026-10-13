"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import type { Option } from "@/components/shared/combobox/combobox";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { OverlayCloseContext } from "@/components/shared/overlay/overlay-context";
import { RowDeleteMenu } from "@/components/shared/row-delete-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeRate } from "../../rate-format";
import { deleteExchangeRateAction } from "../../server/actions";
import {
  ExchangeRateForm,
  type ExchangeRateFormValue,
} from "./exchange-rate-form";

export type ExchangeRateListRow = ExchangeRateFormValue & {
  createdByName: string;
};

export function ExchangeRatesTable({
  org,
  baseCurrency,
  rates,
  currencies,
  canManage,
}: {
  org: string;
  baseCurrency: string;
  rates: ExchangeRateListRow[];
  currencies: Option[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<ExchangeRateListRow | null>(null);
  const columns: ColumnDef<ExchangeRateListRow>[] = [
    {
      accessorKey: "currencyCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Currency" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.currencyCode}</span>
      ),
    },
    {
      accessorKey: "rateDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
    },
    {
      accessorKey: "rate",
      header: "Rate",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {describeRate(
            row.original.currencyCode,
            baseCurrency,
            row.original.rate,
          )}
        </span>
      ),
    },
    {
      accessorKey: "createdByName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created by" />
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(row.original)}
                >
                  Edit
                </Button>
                <RowDeleteMenu
                  rowLabel={`${row.original.currencyCode} ${row.original.rateDate}`}
                  itemLabel="Delete rate"
                  title="Delete this exchange rate?"
                  description={`Documents dated on or after ${row.original.rateDate} will use the previous ${row.original.currencyCode} rate, or fail to resolve one.`}
                  run={() =>
                    deleteExchangeRateAction(org, { id: row.original.id })
                  }
                />
              </div>
            ),
          } satisfies ColumnDef<ExchangeRateListRow>,
        ]
      : []),
  ];
  return (
    <>
      <DataTable
        columns={columns}
        data={rates}
        getRowId={(rate) => rate.id}
        emptyState={{
          title: "No exchange rates match.",
          description: "Add a rate or adjust the filters.",
        }}
      />
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit exchange rate</DialogTitle>
            <DialogDescription>
              Documents that already froze a rate are not changed.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <OverlayCloseContext value={() => setEditing(null)}>
              <ExchangeRateForm
                key={editing.id}
                org={org}
                baseCurrency={baseCurrency}
                currencies={currencies}
                rate={editing}
              />
            </OverlayCloseContext>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
