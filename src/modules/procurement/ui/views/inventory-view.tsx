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
import { inventoryData } from "../../server/list-queries";
import { moduleProjectWhere } from "../../server/queries";
import { formData } from "../../util";
import { ConsumptionTable } from "../components/consumption-table";
import { ProcurementForm } from "../components/procurement-form";
import { StockTable } from "../components/stock-table";
export async function InventoryView({
  org,
  kind,
  projectId,
  searchParams,
}: {
  org: string;
  kind: "stock" | "consumption" | "materials";
  projectId?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const d = await inventoryData(org, projectId, kind, searchParams);
  const writable = await db.project.findMany({
    where: {
      ...moduleProjectWhere(d.ctx, "inventory.consume"),
      id: { in: d.projects.map((p) => p.id) },
    },
    select: { id: true },
  });
  const inputs = kind === "stock" ? null : formData({ ...d, stock: [] });
  if (inputs)
    inputs.projects = inputs.projects.filter((p) =>
      writable.some((w) => w.id === p.id),
    );
  const documents = d.documents.flatMap((rows, index) =>
    rows.map((row) => ({
      ...row,
      kind: (["requests", "orders", "receipts"] as const)[index],
      label: (["Request", "Order", "Receipt"] as const)[index],
    })),
  );
  const stockData = d.stock;
  const usageData = d.history;
  const recordUsage = !!writable.length && inputs && (
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
      <StockTable
        data={stockData}
        baseCurrency={d.baseCurrency}
        serverPage={d.stockPage}
      />
    </>
  );
  const usageSection = (
    <>
      <SectionHeader
        title="Materials used"
        description="Materials taken out of site stock and charged to a stage or task."
        actions={recordUsage}
      />
      <ConsumptionTable
        data={usageData}
        baseCurrency={d.baseCurrency}
        serverPage={d.usagePage}
      />
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
            <StockTable
              data={stockData}
              baseCurrency={d.baseCurrency}
              serverPage={d.stockPage}
            />
          ) : (
            <ConsumptionTable
              data={usageData}
              baseCurrency={d.baseCurrency}
              serverPage={d.usagePage}
            />
          )}
        </FormCard>
        {kind === "consumption" && !!writable.length && inputs && (
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
                  title="Recent requests & deliveries"
                  description="The latest purchase requests, vendor orders, and goods receipts for this project. Open the document lists for full history."
                  actions={
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/${org}/procurement/requests?projectId=${projectId}`}
                        >
                          Requests
                        </Link>
                      </Button>
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
            count: d.stockPage.total,
            content: stockSection,
          },
          {
            value: "used",
            label: "Used",
            count: d.usagePage.total,
            content: usageSection,
          },
        ]}
      />
    </>
  );
}
