"use server";

import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import {
  assertPermission,
  requireOrgContext,
  requireProjectContext,
} from "@/core/context";
import { db } from "@/core/db";
import { id } from "@/core/schema";
import { pickerItems } from "@/modules/masters/server/queries";
import { procurementKind } from "../schema";
import type { ProcurementItem } from "../type";
import { documentKinds } from "./approval";
import { moduleProjectWhere } from "./queries";

const searchInput = z.string().trim().max(150);
const choiceKind = z.enum([
  "vendors",
  "sites",
  "stages",
  "tasks",
  "orders",
  "prLines",
]);
async function pickerContext(
  org: string,
  kind: z.input<typeof procurementKind>,
  projectId: string,
) {
  const parsedKind = procurementKind.parse(kind);
  const ctx = await requireProjectContext(org, id.parse(projectId));
  assertPermission(
    ctx,
    parsedKind === "consumption"
      ? "inventory.consume"
      : documentKinds[parsedKind].permission,
  );
  return ctx;
}
export async function findProcurementProjects(
  org: string,
  kind: z.input<typeof procurementKind>,
  query: string,
): Promise<Option[]> {
  const parsedKind = procurementKind.parse(kind);
  const search = searchInput.parse(query);
  const ctx = await requireOrgContext(org);
  const permission =
    parsedKind === "consumption"
      ? "inventory.consume"
      : documentKinds[parsedKind].permission;
  const projects = await db.project.findMany({
    where: {
      ...moduleProjectWhere(ctx, permission),
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 50,
  });
  return projects.map((p) => ({
    value: p.id,
    label: `${p.code} · ${p.name}`,
    description: p.currency,
  }));
}
export async function findProcurementChoices(
  org: string,
  kind: z.input<typeof procurementKind>,
  projectId: string,
  field: z.input<typeof choiceKind>,
  query: string,
): Promise<Option[]> {
  const search = searchInput.parse(query);
  const selected = choiceKind.parse(field);
  const ctx = await pickerContext(org, kind, projectId);
  const contains = { contains: search, mode: "insensitive" as const };
  switch (selected) {
    case "vendors": {
      const rows = await db.party.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isVendor: true,
          displayName: contains,
        },
        orderBy: { displayName: "asc" },
        take: 50,
      });
      return rows.map((r) => ({ value: r.id, label: r.displayName }));
    }
    case "sites": {
      const rows = await db.projectSite.findMany({
        where: { projectId, name: contains },
        orderBy: { name: "asc" },
        take: 50,
      });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "stages": {
      const rows = await db.stage.findMany({
        where: { projectId, name: contains },
        orderBy: { name: "asc" },
        take: 50,
      });
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "tasks": {
      const rows = await db.task.findMany({
        where: { projectId, OR: [{ title: contains }, { code: contains }] },
        orderBy: { title: "asc" },
        take: 50,
      });
      return rows.map((r) => ({
        value: r.id,
        label: `${r.code} · ${r.title}`,
      }));
    }
    case "orders": {
      assertPermission(ctx, "purchase.view");
      const rows = await db.purchaseOrder.findMany({
        where: {
          organizationId: ctx.org.id,
          projectId,
          status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] },
          code: contains,
        },
        include: { vendor: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return rows.map((r) => ({
        value: r.id,
        label: `${r.code} · ${r.vendor.displayName}`,
      }));
    }
    case "prLines": {
      assertPermission(ctx, "purchase.view");
      const rows = await db.purchaseRequestLine.findMany({
        where: {
          request: {
            organizationId: ctx.org.id,
            projectId,
            status: "APPROVED",
          },
          OR: [
            { variant: { name: contains } },
            { request: { code: contains } },
          ],
        },
        include: { request: true, variant: true },
        take: 50,
      });
      return rows.map((r) => ({
        value: r.id,
        label: `${r.request.code} · ${r.variant.name}`,
      }));
    }
  }
}
export async function findProcurementItems(
  org: string,
  kind: z.input<typeof procurementKind>,
  projectId: string,
  query: string,
): Promise<ProcurementItem[]> {
  const search = searchInput.parse(query).toLowerCase();
  const ctx = await pickerContext(org, kind, projectId);
  const stockOnly = ["consumption", "transfers", "receipts"].includes(kind);
  const [items, uoms] = await Promise.all([
    pickerItems(ctx.tenant.id, stockOnly),
    db.uom.findMany({
      where: { OR: [{ tenantId: ctx.tenant.id }, { tenantId: null }] },
    }),
  ]);
  return items
    .filter((i) => i.name.toLowerCase().includes(search))
    .slice(0, 50)
    .map((item) => ({
      ...item,
      uomIds: uoms
        .filter(
          (u) =>
            u.groupId ===
            uoms.find((unit) => unit.id === item.stockUomId)?.groupId,
        )
        .map((u) => u.id),
    }));
}

export async function procurementSource(
  org: string,
  kind: z.input<typeof procurementKind>,
  projectId: string,
  sourceId: string,
) {
  const ctx = await pickerContext(org, kind, projectId);
  assertPermission(ctx, "purchase.view");
  id.parse(sourceId);
  if (kind === "receipts") {
    const order = await db.purchaseOrder.findFirstOrThrow({
      where: {
        id: sourceId,
        organizationId: ctx.org.id,
        projectId,
        status: {
          in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED"],
        },
      },
      include: { lines: { include: { variant: true } } },
    });
    return {
      poLines: order.lines.map((l) => ({
        id: l.id,
        name: l.variant.name,
        itemId: l.variant.itemId,
        item: {
          itemId: l.variant.itemId,
          level1: l.variant.level1Id,
          level2: l.variant.level2Id,
          level3: l.variant.level3Id,
          level4: l.variant.level4Id,
          level5: l.variant.level5Id,
        },
        uomId: l.uomId,
        pending: l.qty.sub(l.receivedQty).toString(),
      })),
      prLine: null,
    };
  }
  if (kind !== "orders") throw new Error("Invalid source kind.");
  const line = await db.purchaseRequestLine.findFirstOrThrow({
    where: {
      id: sourceId,
      request: { organizationId: ctx.org.id, projectId, status: "APPROVED" },
    },
    include: { variant: true },
  });
  return {
    poLines: [],
    prLine: {
      itemId: line.variant.itemId,
      levels: [
        line.variant.level1Id,
        line.variant.level2Id,
        line.variant.level3Id,
        line.variant.level4Id,
        line.variant.level5Id,
      ],
      qty: line.qty.toString(),
      uomId: line.uomId,
      description: line.description,
      rate: line.estimatedRate.toString(),
      prLineId: line.id,
    },
  };
}
