import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { MaterialCostRecognitionBadge } from "@/components/shared/material-cost-recognition-badge";
import { CreateSheet } from "@/components/shared/overlay/side-sheet";
import { PageHeading } from "@/components/shared/page-heading";
import { SectionHeader } from "@/components/shared/section-header";
import { UrlTabs } from "@/components/shared/url-tabs";
import { Button } from "@/components/ui/button";
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
  const documents = [
    ...d.requests.map((r) => ({ ...r, kind: "requests", label: "Request" })),
    ...d.orders.map((r) => ({ ...r, kind: "orders", label: "Order" })),
    ...d.receipts.map((r) => ({ ...r, kind: "receipts", label: "Receipt" })),
  ];
  const stockData = d.stock.map((s) => ({
    id: `${s.projectId}:${s.variantId}`,
    project: d.projects.find((p) => p.id === s.projectId)?.name ?? "",
    name: s.name,
    qty: s.qty,
    uom: s.uom,
    avgCost: s.avgCost,
    value: s.value,
  }));
  const usageData = d.consumptions.flatMap((c) =>
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
  );
  const recordUsage = !!writable.length && (
    <CreateSheet
      label="Record usage"
      title="Record material usage"
      description="Take materials out of site stock and charge them to a stage or task."
    >
      <ProcurementForm
        org={org}
        kind="consumption"
        data={inputs}
        projectId={projectId}
      />
    </CreateSheet>
  );
  const stockSection = (
    <>
      <SectionHeader
        title="Stock on site"
        description="Materials currently held on site: received and not yet used or transferred out, with their average cost and value."
      />
      <StockTable data={stockData} />
    </>
  );
  const usageSection = (
    <>
      <SectionHeader
        title="Materials used"
        description="Materials taken out of site stock and charged to a stage or task."
        actions={recordUsage}
      />
      <ConsumptionTable data={usageData} />
    </>
  );

  if (kind !== "materials") {
    return (
      <>
        <PageHeading
          title={kind === "stock" ? "Stock on hand" : "Material consumption"}
          description="Material cost recognition follows each project's setting. Stock uses moving average valuation."
        />
        <FormCard title={kind === "stock" ? "Stock on hand" : "Materials used"}>
          {kind === "stock" ? (
            <StockTable data={stockData} />
          ) : (
            <ConsumptionTable data={usageData} />
          )}
        </FormCard>
        {kind === "consumption" && !!writable.length && (
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
    );
  }

  const project = d.projects.find((p) => p.id === projectId);
  return (
    <>
      <SectionHeader
        title="Project materials"
        description="Track materials from request to site to use: what has been asked for, what is on site, and what has been consumed."
        actions={
          project && (
            <MaterialCostRecognitionBadge
              mode={project.materialCostRecognition}
            />
          )
        }
      />
      <UrlTabs
        tabs={[
          {
            value: "purchasing",
            label: "Requested & ordered",
            count: documents.length,
            content: (
              <>
                <SectionHeader
                  title="Requested & ordered"
                  description="Purchase requests raised for this project, the orders placed with vendors, and the goods receipts when materials arrive."
                  actions={
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/${org}/procurement/orders?projectId=${projectId}`}
                        >
                          Orders
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/${org}/procurement/receipts?projectId=${projectId}`}
                        >
                          Receipts
                        </Link>
                      </Button>
                      <Button asChild size="sm">
                        <Link
                          href={`/${org}/procurement/requests?projectId=${projectId}`}
                        >
                          New request
                        </Link>
                      </Button>
                    </>
                  }
                />
                {documents.length ? (
                  <ItemGroup>
                    {documents.map((r) => (
                      <Item key={r.id} variant="outline">
                        <ItemContent>
                          <ItemTitle>
                            <Link
                              className="underline"
                              href={`/${org}/procurement/${r.kind}/${r.id}`}
                            >
                              {r.code}
                            </Link>{" "}
                            · {r.label} · {r.status}
                          </ItemTitle>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                ) : (
                  <EmptyState title="No requests, orders or receipts yet." />
                )}
              </>
            ),
          },
          {
            value: "stock",
            label: "On site",
            count: stockData.length,
            content: stockSection,
          },
          {
            value: "used",
            label: "Used",
            count: usageData.length,
            content: usageSection,
          },
        ]}
      />
    </>
  );
}
