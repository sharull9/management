import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/core/db";
import { MasterFormPage } from "@/modules/masters/ui/components/master-pages";
import { type DocumentKind, documentKinds } from "../../server/approval";
import {
  documentDetail,
  moduleProjectWhere,
  procurementData,
} from "../../server/queries";
import { formData } from "../../util";
import {
  draftFormValues,
  withDraftRequestLines,
  withReceiptOrder,
} from "../components/draft-form-data";
import { ProcurementForm } from "../components/procurement-form";

const labels = {
  requests: { list: "Purchase requests", one: "purchase request" },
  orders: { list: "Purchase orders", one: "purchase order" },
  receipts: { list: "Goods receipts", one: "goods receipt" },
  transfers: { list: "Stock transfers", one: "stock transfer" },
};

export async function ProcurementNew({
  org,
  kind,
  projectId,
}: {
  org: string;
  kind: DocumentKind;
  projectId?: string;
}) {
  const d = await procurementData(
    org,
    projectId,
    kind === "transfers",
    kind,
    false,
  );
  const writable = await db.project.findMany({
    where: {
      ...moduleProjectWhere(d.ctx, documentKinds[kind].permission),
      id: { in: d.projects.map((p) => p.id) },
    },
    select: { id: true },
  });
  const inputs = formData(d);
  inputs.projects = inputs.projects.filter((p) =>
    writable.some((w) => w.id === p.id),
  );
  const { list, one } = labels[kind];
  return (
    <MasterFormPage
      backHref={`/${org}/procurement/${kind}`}
      backLabel={list}
      title={`New ${one}`}
      description="Save as a draft, then submit it for approval from the document page."
      cardTitle="Document details"
    >
      {writable.length ? (
        <ProcurementForm
          org={org}
          kind={kind}
          data={inputs}
          projectId={projectId}
        />
      ) : (
        <EmptyState title="You do not have access to any project for this document." />
      )}
    </MasterFormPage>
  );
}

export async function ProcurementEdit({
  org,
  kind,
  documentId,
}: {
  org: string;
  kind: DocumentKind;
  documentId: string;
}) {
  const { ctx, row } = await documentDetail(org, kind, documentId);
  const detailHref = `/${org}/procurement/${kind}/${documentId}`;
  const canEdit =
    ctx.isAdmin || ctx.permissions.has(documentKinds[kind].permission);
  if (row.status !== "DRAFT" || !canEdit) redirect(detailHref);
  const selectedItemIds = row.lines.flatMap((line) =>
    "variant" in line
      ? [line.variant.itemId]
      : "poLine" in line
        ? [line.poLine.variant.itemId]
        : [],
  );
  const d = await procurementData(
    org,
    undefined,
    kind === "transfers",
    kind,
    false,
    true,
    selectedItemIds,
  );
  const inputs = withDraftRequestLines(withReceiptOrder(formData(d), row), row);
  if (!inputs.projects.some((p) => p.id === row.projectId)) notFound();
  const { initial, initialLines } = draftFormValues(row);
  const { list, one } = labels[kind];
  return (
    <MasterFormPage
      backHref={detailHref}
      backLabel={row.code}
      title={`Edit ${row.code}`}
      description={`Update this draft ${one} before submitting it for approval. ${list} cannot be changed once submitted.`}
      cardTitle="Document details"
    >
      <ProcurementForm
        org={org}
        kind={kind}
        data={inputs}
        id={row.id}
        projectId={row.projectId}
        initial={initial}
        initialLines={initialLines}
      />
    </MasterFormPage>
  );
}
