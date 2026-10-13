"use server";
import { z } from "zod";
import type { Option } from "@/components/shared/combobox/combobox";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { moduleProjectWhere } from "@/modules/procurement/server/queries";
import { invoiceItems } from "./picker-queries";

async function pickerContext(org: string, query: string, permission: string) {
  const search = z.string().trim().max(150).parse(query);
  z.enum(["sales.view", "sales.invoice.create"]).parse(permission);
  const ctx = await requireOrgContext(org);
  if (!ctx.isAdmin && !ctx.permissions.has(permission)) {
    const project = await db.project.findFirst({
      where: moduleProjectWhere(ctx, permission),
      select: { id: true },
    });
    if (!project) assertPermission(ctx, permission);
  }
  return { ctx, search };
}
export async function findInvoiceCustomers(
  org: string,
  permission: string,
  query: string,
) {
  const { ctx, search } = await pickerContext(org, query, permission);
  const rows = await db.party.findMany({
    where: {
      tenantId: ctx.tenant.id,
      isCustomer: true,
      displayName: { contains: search, mode: "insensitive" },
    },
    include: { addresses: { orderBy: { isDefault: "desc" }, take: 1 } },
    orderBy: { displayName: "asc" },
    take: 30,
  });
  return rows.map(
    (row) =>
      ({
        value: row.id,
        label: row.displayName,
        stateId: row.addresses[0]?.stateId ?? null,
        paymentTerms: row.paymentTerms,
        defaultCurrency: row.defaultCurrency,
      }) satisfies Option & {
        stateId: string | null;
        paymentTerms: number;
        defaultCurrency: string | null;
      },
  );
}
export async function findInvoiceProjects(
  org: string,
  permission: string,
  query: string,
) {
  const { ctx, search } = await pickerContext(org, query, permission);
  const rows = await db.project.findMany({
    where: {
      ...moduleProjectWhere(ctx, permission),
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 30,
  });
  return rows.map((row) => ({
    value: row.id,
    label: `${row.code} / ${row.name}`,
    clientPartyId: row.clientPartyId,
  }));
}
export async function findInvoiceItems(org: string, query: string) {
  const { ctx, search } = await pickerContext(
    org,
    query,
    "sales.invoice.create",
  );
  return invoiceItems(ctx.tenant.id, search);
}
export async function findInvoiceTaxGroups(
  org: string,
  scope: string,
  query: string,
) {
  const { ctx, search } = await pickerContext(
    org,
    query,
    "sales.invoice.create",
  );
  z.enum(["ANY", "INTRA", "INTER"]).parse(scope);
  const groups = await db.taxGroup.findMany({
    where: {
      tenantId: ctx.tenant.id,
      name: { contains: search, mode: "insensitive" },
      ...(scope === "ANY"
        ? {}
        : { scope: { in: ["ANY", scope as "INTRA" | "INTER"] } }),
    },
    include: {
      components: {
        include: { component: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 30,
  });
  return groups.map((group) => ({
    value: group.id,
    label: group.name,
    scope: group.scope,
    components: group.components.map(({ component }) => ({
      id: component.id,
      name: component.name,
      rate: component.rate.toString(),
      isWithholding: component.isWithholding,
      appliesTo: component.appliesTo,
    })),
  }));
}
export async function invoiceCustomerDefaults(org: string, id: string) {
  const { ctx } = await pickerContext(org, "", "sales.invoice.create");
  z.string().min(1).max(100).parse(id);
  const row = await db.party.findFirstOrThrow({
    where: { id, tenantId: ctx.tenant.id, isCustomer: true },
    include: { addresses: { orderBy: { isDefault: "desc" }, take: 1 } },
  });
  return {
    id: row.id,
    name: row.displayName,
    stateId: row.addresses[0]?.stateId ?? null,
    paymentTerms: row.paymentTerms,
    defaultCurrency: row.defaultCurrency,
  };
}

export async function invoiceTaxGroupDefaults(org: string, input: string[]) {
  const { ctx } = await pickerContext(org, "", "sales.invoice.create");
  const ids = z.array(z.string().min(1).max(100)).max(30).parse(input);
  const groups = await db.taxGroup.findMany({
    where: {
      tenantId: ctx.tenant.id,
      id: { in: ids },
    },
    include: {
      components: {
        include: { component: true },
        orderBy: { sequence: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 30,
  });
  return groups.map((group) => ({
    value: group.id,
    label: group.name,
    scope: group.scope,
    components: group.components.map(({ component }) => ({
      id: component.id,
      name: component.name,
      rate: component.rate.toString(),
      isWithholding: component.isWithholding,
      appliesTo: component.appliesTo,
    })),
  }));
}
