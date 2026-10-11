import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { db } from "@/core/db";
import { type DocumentKind, documentKinds } from "../../server/approval";
import { moduleProjectWhere, procurementData } from "../../server/queries";
import { formData } from "../../util";
import { DocumentsTable } from "../components/documents-table";
import { ProcurementForm } from "../components/procurement-form";

const titles = {
  requests: "Purchase requests",
  orders: "Purchase orders",
  receipts: "Goods receipts",
  transfers: "Stock transfers",
};
export async function ProcurementList({
  org,
  kind,
  projectId,
}: {
  org: string;
  kind: DocumentKind;
  projectId?: string;
}) {
  const d = await procurementData(org, projectId, kind === "transfers");
  const rows = d[kind];
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
  return (
    <>
      <PageHeading
        title={titles[kind]}
        description="Draft, submit, and follow approval and receipt progress."
      />
      <FormCard title="Documents">
        <DocumentsTable
          data={rows.map((r) => ({
            id: r.id,
            code: r.code,
            project: r.project.name,
            status: r.status,
            date: r.createdAt.toISOString(),
            total:
              "grandTotal" in r
                ? r.grandTotal.toString()
                : "estimatedTotal" in r
                  ? r.estimatedTotal.toString()
                  : null,
            destination: "toProject" in r ? r.toProject.name : "",
            href: `/${org}/${kind === "transfers" ? "inventory" : "procurement"}/${kind}/${r.id}`,
          }))}
        />
      </FormCard>
      {!!writable.length && (
        <FormCard
          title={`Create ${kind === "requests" ? "purchase request" : kind === "orders" ? "purchase order" : kind === "receipts" ? "goods receipt" : "stock transfer"}`}
        >
          <ProcurementForm
            org={org}
            kind={kind}
            data={inputs}
            projectId={projectId}
          />
        </FormCard>
      )}
    </>
  );
}
