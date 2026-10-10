import Link from "next/link";
import { FormCard } from "@/components/shared/form-card";
import { MaterialCostRecognitionBadge } from "@/components/shared/material-cost-recognition-badge";
import { PageHeading } from "@/components/shared/page-heading";
import { db } from "@/core/db";
import {
  moduleProjectWhere,
  procurementData,
} from "@/server/procurement/queries";
import { ProcurementForm } from "./procurement-form";
import { formData } from "./procurement-pages";
export async function InventoryPage({
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
          <ul className="mt-4 space-y-2 text-sm">
            {[
              ...d.requests.map((r) => ({ ...r, kind: "requests" })),
              ...d.orders.map((r) => ({ ...r, kind: "orders" })),
              ...d.receipts.map((r) => ({ ...r, kind: "receipts" })),
            ].map((r) => (
              <li key={r.id}>
                <Link
                  className="underline"
                  href={`/${org}/procurement/${r.kind}/${r.id}`}
                >
                  {r.code}
                </Link>{" "}
                · {r.status}
              </li>
            ))}
          </ul>
        </FormCard>
      )}
      {kind !== "consumption" && (
        <FormCard title="Stock on hand">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Project",
                    "Item variant",
                    "Quantity",
                    "UOM",
                    "Average cost",
                    "Value",
                  ].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.stock.map((s) => (
                  <tr
                    key={`${s.projectId}:${s.variantId}`}
                    className="border-t"
                  >
                    <td className="p-2">
                      {d.projects.find((p) => p.id === s.projectId)?.name}
                    </td>
                    <td className="p-2">{s.name}</td>
                    <td className="p-2">{s.qty}</td>
                    <td className="p-2">{s.uom}</td>
                    <td className="p-2">{s.avgCost}</td>
                    <td className="p-2">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!d.stock.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              No stock movements yet.
            </p>
          )}
        </FormCard>
      )}
      {kind !== "stock" && (
        <>
          <FormCard title="Consumption history">
            <ul className="space-y-4 text-sm">
              {d.consumptions.map((c) => (
                <li key={c.id}>
                  <p className="font-medium">
                    {c.code} · {c.project.name} ·{" "}
                    {c.date.toISOString().slice(0, 10)} ·{" "}
                    {c.stage?.name ?? "Unallocated"} · {c.task?.title ?? ""}
                  </p>
                  <ul>
                    {c.lines.map((l) => (
                      <li key={l.id}>
                        {l.variant.name} · {l.qty.toString()} {l.uom.code} ·
                        Stock value {l.totalCost.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {!d.consumptions.length && (
              <p className="text-sm text-muted-foreground">
                No consumption yet.
              </p>
            )}
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
