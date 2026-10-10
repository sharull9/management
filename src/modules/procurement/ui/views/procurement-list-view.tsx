import Link from "next/link";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import { db } from "@/core/db";
import { type DocumentKind, documentKinds } from "../../server/approval";
import { moduleProjectWhere, procurementData } from "../../server/queries";
import { formData } from "../../util";
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Number</th>
                <th className="p-2">Project</th>
                <th className="p-2">Status</th>
                <th className="p-2">Total / destination</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">
                    <Link
                      className="underline"
                      href={`/${org}/${kind === "transfers" ? "inventory" : "procurement"}/${kind}/${r.id}`}
                    >
                      {r.code}
                    </Link>
                  </td>
                  <td className="p-2">{r.project.name}</td>
                  <td className="p-2">
                    <Badge variant="secondary">
                      {r.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td className="p-2">
                    {"grandTotal" in r
                      ? r.grandTotal.toFixed(2)
                      : "estimatedTotal" in r
                        ? r.estimatedTotal.toFixed(2)
                        : "toProject" in r
                          ? r.toProject.name
                          : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            No documents yet.
          </p>
        )}
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
