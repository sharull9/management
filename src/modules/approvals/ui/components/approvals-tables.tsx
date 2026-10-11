"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable } from "@/components/shared/data-table/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table/data-table-column-header";
import { DetailList } from "@/components/shared/detail-list";
import { DetailSheet } from "@/components/shared/overlay/side-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Separator } from "@/components/ui/separator";
import type { HistoryRow, PendingRow } from "../../type";
import { ApprovalDecisionForm, CancelApprovalForm } from "./approval-forms";

export function PendingApprovalsTable({
  org,
  data,
}: {
  org: string;
  data: PendingRow[];
}) {
  const columns: ColumnDef<PendingRow>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Document" />
      ),
      cell: ({ row }) => (
        <Link
          className="font-medium underline-offset-4 hover:text-primary hover:underline"
          href={row.original.href}
        >
          {row.original.title}
        </Link>
      ),
    },
    { accessorKey: "documentType", header: "Type" },
    { accessorKey: "stepName", header: "Step" },
    { accessorKey: "requestedBy", header: "Requested by" },
    { accessorKey: "amount", header: "Amount" },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requested" />
      ),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("en-IN"),
    },
    {
      id: "decision",
      header: () => <span className="sr-only">Decision</span>,
      cell: ({ row }) => (
        <DetailSheet
          label="Review"
          title={row.original.title}
          description={`${row.original.documentType} · ${row.original.stepName}`}
        >
          <div className="space-y-6">
            <DetailList
              items={[
                { label: "Type", value: row.original.documentType },
                { label: "Step", value: row.original.stepName },
                { label: "Requested by", value: row.original.requestedBy },
                {
                  label: "Requested",
                  value: new Date(row.original.createdAt).toLocaleDateString(
                    "en-IN",
                  ),
                },
                ...(row.original.amount
                  ? [{ label: "Amount", value: row.original.amount }]
                  : []),
                {
                  label: "Document",
                  value: (
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={row.original.href}
                    >
                      Open document
                    </Link>
                  ),
                },
              ]}
            />
            <Separator />
            <ApprovalDecisionForm org={org} stepId={row.original.id} />
          </div>
        </DetailSheet>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search pending approvals"
      emptyState={{ title: "You have no pending approval steps." }}
    />
  );
}

export function ApprovalHistoryTable({
  org,
  data,
}: {
  org: string;
  data: HistoryRow[];
}) {
  const columns: ColumnDef<HistoryRow>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Document" />
      ),
      cell: ({ row }) => (
        <Link
          className="font-medium underline-offset-4 hover:text-primary hover:underline"
          href={row.original.href}
        >
          {row.original.title}
        </Link>
      ),
    },
    { accessorKey: "documentType", header: "Type" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    { accessorKey: "requestedBy", header: "Requested by" },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requested" />
      ),
      cell: ({ row }) =>
        new Date(row.original.createdAt).toLocaleDateString("en-IN"),
    },
    {
      id: "details",
      header: () => <span className="sr-only">Details</span>,
      cell: ({ row }) => (
        <DetailSheet
          label="Details"
          title={row.original.title}
          description={row.original.documentType}
        >
          <div className="space-y-6">
            <DetailList
              items={[
                {
                  label: "Status",
                  value: <StatusBadge status={row.original.status} />,
                },
                { label: "Requested by", value: row.original.requestedBy },
                {
                  label: "Requested",
                  value: new Date(row.original.createdAt).toLocaleDateString(
                    "en-IN",
                  ),
                },
                {
                  label: "Document",
                  value: (
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={row.original.href}
                    >
                      Open document
                    </Link>
                  ),
                },
              ]}
            />
            <section className="space-y-3">
              <h3 className="text-sm font-medium">Approval steps</h3>
              <ol className="relative space-y-4 border-l pl-5">
                {row.original.steps.map((step) => (
                  <li key={step.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-muted-foreground"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {step.sequence}. {step.name}
                      </span>
                      <StatusBadge status={step.status} />
                    </div>
                    {step.actedBy && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        by {step.actedBy}
                      </p>
                    )}
                    {step.comment && (
                      <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm break-words">
                        {step.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
            {row.original.canCancel && (
              <>
                <Separator />
                <CancelApprovalForm org={org} requestId={row.original.id} />
              </>
            )}
          </div>
        </DetailSheet>
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search request history"
      emptyState={{ title: "No approval requests yet." }}
    />
  );
}
