import { UserFacingError } from "@/core/errors";
import "server-only";
import { writeAudit } from "@/core/audit";
import type { OrgContext } from "@/core/context";
import type { Prisma } from "@/generated/prisma/client";
import { SYSTEM_ACCOUNTS, type SystemAccountKey } from "../constants";
import { lockAccountingScope, lockAccountingTenant } from "./locking";

type Tx = Prisma.TransactionClient;
type AccountInput = {
  id?: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  active: boolean;
};

async function organization(tx: Tx, organizationId: string) {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, tenantId: true },
  });
  if (!org) throw new UserFacingError("Organization not found.");
  return org;
}

async function audit(
  tx: Tx,
  ctx: OrgContext,
  entityType: string,
  entityId: string,
  action: string,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType,
      entityId,
      action,
    },
    tx,
  );
}

export async function ensureOrgChart(
  tx: Tx,
  organizationId: string,
  actorId: string,
) {
  const org = await organization(tx, organizationId);
  await lockAccountingTenant(tx, org.tenantId);
  const templates = await tx.accountTemplate.findMany({
    where: { tenantId: org.tenantId },
  });
  const byKey = new Map(
    templates
      .filter((row) => row.systemKey)
      .map((row) => [row.systemKey!, row]),
  );
  const accounts = await tx.ledgerAccount.findMany({
    where: { organizationId },
  });
  const byAccountKey = new Map(
    accounts.filter((row) => row.systemKey).map((row) => [row.systemKey!, row]),
  );
  const templateCodes = new Map(templates.map((row) => [row.code, row]));
  const accountCodes = new Map(accounts.map((row) => [row.code, row]));
  for (const item of SYSTEM_ACCOUNTS) {
    let template = byKey.get(item.key);
    if (!template) {
      const codeOwner = templateCodes.get(item.code);
      if (codeOwner)
        throw new UserFacingError(
          `Cannot initialize ${item.key}: template code ${item.code} is already used by ${codeOwner.systemKey ?? "a custom template"}.`,
        );
      template = await tx.accountTemplate.create({
        data: {
          tenantId: org.tenantId,
          code: item.code,
          name: item.name,
          type: item.type,
          systemKey: item.key,
        },
      });
      byKey.set(item.key, template);
      templateCodes.set(item.code, template);
      await writeAudit(
        {
          tenantId: org.tenantId,
          userId: actorId,
          entityType: "AccountTemplate",
          entityId: template.id,
          action: "CREATE_DEFAULT",
        },
        tx,
      );
    } else if (
      template.code !== item.code ||
      template.type !== item.type ||
      !template.active
    ) {
      throw new UserFacingError(
        `Default template ${item.key} has an invalid code, type, or inactive status.`,
      );
    }
    if (!byAccountKey.has(item.key)) {
      const codeOwner = accountCodes.get(item.code);
      if (codeOwner)
        throw new UserFacingError(
          `Cannot initialize ${item.key}: account code ${item.code} is already used by ${codeOwner.systemKey ?? "a custom account"}.`,
        );
      const row = await tx.ledgerAccount.create({
        data: {
          organizationId,
          templateId: template.id,
          code: template.code,
          name: template.name,
          type: template.type,
          systemKey: item.key,
        },
      });
      byAccountKey.set(item.key, row);
      accountCodes.set(row.code, row);
      await writeAudit(
        {
          tenantId: org.tenantId,
          organizationId,
          userId: actorId,
          entityType: "LedgerAccount",
          entityId: row.id,
          action: "CREATE_DEFAULT",
        },
        tx,
      );
    } else {
      const row = byAccountKey.get(item.key)!;
      if (row.type !== item.type || row.code !== item.code || !row.active)
        throw new UserFacingError(
          `System account ${item.key} has an invalid code, type, or inactive status.`,
        );
    }
  }
  return byAccountKey as Map<SystemAccountKey, (typeof accounts)[number]>;
}

async function assertManage(ctx: OrgContext, tx: Tx) {
  const org = await organization(tx, ctx.org.id);
  if (org.tenantId !== ctx.tenant.id)
    throw new UserFacingError("Organization does not belong to this tenant.");
  if (!ctx.isAdmin && !ctx.permissions.has("accounting.manage"))
    throw new UserFacingError("Accounting management permission is required.");
  return org;
}

export async function saveAccount(
  tx: Tx,
  ctx: OrgContext,
  input: AccountInput,
) {
  await assertManage(ctx, tx);
  const existing = input.id
    ? await tx.ledgerAccount.findFirst({
        where: { id: input.id, organizationId: ctx.org.id },
      })
    : null;
  if (input.id && !existing)
    throw new UserFacingError("Account not found in this organization.");
  if (existing?.systemKey)
    throw new UserFacingError("System accounts cannot be edited.");
  if (
    existing &&
    existing.type !== input.type &&
    (await tx.journalLine.count({
      where: {
        organizationId: ctx.org.id,
        accountId: existing.id,
        journalEntry: { status: "POSTED" },
      },
    }))
  )
    throw new UserFacingError(
      "An account with posted activity cannot change type.",
    );
  const duplicate = await tx.ledgerAccount.findFirst({
    where: {
      organizationId: ctx.org.id,
      code: input.code,
      ...(existing ? { id: { not: existing.id } } : {}),
    },
  });
  if (duplicate)
    throw new UserFacingError("An account with this code already exists.");
  const row = existing
    ? await tx.ledgerAccount.update({
        where: { id: existing.id },
        data: {
          code: input.code,
          name: input.name,
          type: input.type,
          active: input.active,
        },
      })
    : await tx.ledgerAccount.create({
        data: {
          organizationId: ctx.org.id,
          code: input.code,
          name: input.name,
          type: input.type,
          active: input.active,
        },
      });
  await audit(tx, ctx, "LedgerAccount", row.id, existing ? "UPDATE" : "CREATE");
  return row;
}

async function assertTenantAdmin(ctx: OrgContext, tx: Tx) {
  await assertManage(ctx, tx);
  const member = await tx.tenantMember.findUnique({
    where: {
      tenantId_userId: { tenantId: ctx.tenant.id, userId: ctx.user.id },
    },
    select: { role: true },
  });
  if (member?.role !== "OWNER" && member?.role !== "ADMIN")
    throw new UserFacingError(
      "Tenant owner or administrator access is required.",
    );
}

export async function saveTemplate(
  tx: Tx,
  ctx: OrgContext,
  input: AccountInput,
) {
  await assertTenantAdmin(ctx, tx);
  const existing = input.id
    ? await tx.accountTemplate.findFirst({
        where: { id: input.id, tenantId: ctx.tenant.id },
      })
    : null;
  if (input.id && !existing)
    throw new UserFacingError("Template not found in this tenant.");
  if (existing?.systemKey)
    throw new UserFacingError("System templates cannot be edited.");
  const duplicate = await tx.accountTemplate.findFirst({
    where: {
      tenantId: ctx.tenant.id,
      code: input.code,
      ...(existing ? { id: { not: existing.id } } : {}),
    },
  });
  if (duplicate)
    throw new UserFacingError("A template with this code already exists.");
  const row = existing
    ? await tx.accountTemplate.update({
        where: { id: existing.id },
        data: {
          code: input.code,
          name: input.name,
          type: input.type,
          active: input.active,
        },
      })
    : await tx.accountTemplate.create({
        data: {
          tenantId: ctx.tenant.id,
          code: input.code,
          name: input.name,
          type: input.type,
          active: input.active,
        },
      });
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      entityType: "AccountTemplate",
      entityId: row.id,
      action: existing ? "UPDATE" : "CREATE",
    },
    tx,
  );
  return row;
}

export async function applyTemplates(tx: Tx, ctx: OrgContext) {
  const org = await assertManage(ctx, tx);
  await lockAccountingScope(tx, org.id);
  const map = await ensureOrgChart(tx, org.id, ctx.user.id);
  const templates = await tx.accountTemplate.findMany({
    where: { tenantId: org.tenantId, active: true },
    orderBy: { code: "asc" },
  });
  const existing = await tx.ledgerAccount.findMany({
    where: { organizationId: org.id },
    select: { id: true, code: true, systemKey: true },
  });
  const codes = new Set(existing.map((row) => row.code));
  const keys = new Set(existing.map((row) => row.systemKey).filter(Boolean));
  for (const template of templates) {
    if (
      (template.systemKey && keys.has(template.systemKey)) ||
      codes.has(template.code)
    )
      continue;
    const row = await tx.ledgerAccount.create({
      data: {
        organizationId: org.id,
        templateId: template.id,
        code: template.code,
        name: template.name,
        type: template.type,
        systemKey: template.systemKey,
      },
    });
    codes.add(row.code);
    if (row.systemKey) keys.add(row.systemKey);
    await audit(tx, ctx, "LedgerAccount", row.id, "APPLY_TEMPLATE");
  }
  return map;
}
