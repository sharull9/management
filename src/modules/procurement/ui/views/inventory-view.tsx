import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { MaterialCostRecognitionBadge } from "@/components/shared/material-cost-recognition-badge";
import { PageHeading } from "@/components/shared/page-heading";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { db } from "@/core/db";
import { moduleProjectWhere, procurementData } from "../../server/queries";
import { formData } from "../../util";
import { ConsumptionTable } from "../components/consumption-table";
import { ProcurementForm } from "../components/procurement-form";
import { StockTable } from "../components/stock-table";
export async function InventoryView({
  org,
  kind,
  projectId,
}: {
  org: string;
  kind: "stock" | "consumption" | "materials";
  projectId?: string;
}) {
  const d = await procurementData(org, projectId, true);
  const writable = await db.project.findMany({
    where: {
      ...moduleProjectWhere(d.ctx, "inventory.consume"),
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
        title={
          kind === "materials"
            ? "Project materials"
            : kind === "stock"
              ? "Stock on hand"
              : "Material consumption"
        }
        description="Material cost recognition follows each project's setting. Stock uses moving average valuation."
      />
      {kind === "materials" &&
        d.projects
          .filter((p) => p.id === projectId)
          .map((p) => (
            <MaterialCostRecognitionBadge
              key={p.id}
              mode={p.materialCostRecognition}
            />
          ))}
      {kind === "materials" && (
        <FormCard title="Procurement">
          <div className="flex flex-wrap gap-4 text-sm">
            {["requests", "orders", "receipts"].map((k) => (
              <Link
                key={k}
                className="underline"
                href={`/${org}/procurement/${k}?projectId=${projectId}`}
              >
                Create / view {k}
              </Link>
            ))}
          </div>
          <ItemGroup className="mt-4">
            {[
              ...d.requests.map((r) => ({ ...r, kind: "requests" })),
              ...d.orders.map((r) => ({ ...r, kind: "orders" })),
              ...d.receipts.map((r) => ({ ...r, kind: "receipts" })),
            ].map((r) => (
              <Item key={r.id} variant="outline">
                <ItemContent>
                  <ItemTitle>
                    <Link
                      className="underline"
                      href={`/${org}/procurement/${r.kind}/${r.id}`}
                    >
                      {r.code}
                    </Link>{" "}
                    · {r.status}
                  </ItemTitle>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
          {!d.requests.length && !d.orders.length && !d.receipts.length && (
            <EmptyState title="No procurement documents yet." />
          )}
        </FormCard>
      )}
      {kind !== "consumption" && (
        <FormCard title="Stock on hand">
          <StockTable
            data={d.stock.map((s) => ({
              id: `${s.projectId}:${s.variantId}`,
              project: d.projects.find((p) => p.id === s.projectId)?.name ?? "",
              name: s.name,
              qty: s.qty,
              uom: s.uom,
              avgCost: s.avgCost,
              value: s.value,
            }))}
          />
        </FormCard>
      )}
      {kind !== "stock" && (
        <>
          <FormCard title="Consumption history">
            <ConsumptionTable
              data={d.consumptions.flatMap((c) =>
                c.lines.map((l) => ({
                  id: l.id,
                  code: c.code,
                  project: c.project.name,
                  date: c.date.toISOString(),
                  stage: c.stage?.name ?? "Unallocated",
                  task: c.task?.title ?? "",
                  item: l.variant.name,
                  qty: l.qty.toString(),
                  uom: l.uom.code,
                  value: l.totalCost.toString(),
                })),
              )}
            />
          </FormCard>
          {!!writable.length && (
            <FormCard title="Record material consumption">
              <ProcurementForm
                org={org}
                kind="consumption"
                data={inputs}
                projectId={projectId}
              />
            </FormCard>
          )}
        </>
      )}
    </>
  );
}
