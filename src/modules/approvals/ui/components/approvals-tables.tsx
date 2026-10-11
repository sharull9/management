"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table/index";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
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
        <Link className="underline" href={row.original.href}>
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
      header: "Decision",
      cell: ({ row }) => (
        <details className="min-w-64">
          <summary className="cursor-pointer text-sm">Review step</summary>
          <div className="pt-4">
            <ApprovalDecisionForm org={org} stepId={row.original.id} />
          </div>
        </details>
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
        <Link className="underline" href={row.original.href}>
          {row.original.title}
        </Link>
      ),
    },
    { accessorKey: "documentType", header: "Type" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.status}</Badge>
      ),
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
      header: "Details",
      cell: ({ row }) => (
        <details className="min-w-64">
          <summary className="cursor-pointer text-sm">Request details</summary>
          <div className="space-y-4 pt-4">
            <ItemGroup className="gap-3">
              {row.original.steps.map((step) => (
                <Item key={step.id} variant="muted">
                  <ItemContent>
                    <ItemTitle className="line-clamp-none break-words">
                      {step.sequence}. {step.name} · {step.status}
                      {step.actedBy ? ` · ${step.actedBy}` : ""}
                    </ItemTitle>
                    {step.comment && (
                      <ItemDescription className="line-clamp-none break-words">
                        {step.comment}
                      </ItemDescription>
                    )}
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
            {row.original.canCancel && (
              <CancelApprovalForm org={org} requestId={row.original.id} />
            )}
          </div>
        </details>
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
