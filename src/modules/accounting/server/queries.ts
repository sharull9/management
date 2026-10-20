import { UserFacingError } from "@/core/errors";
import "server-only";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { type ListParams, listParams, pageInfo } from "@/core/pagination";
import { canActOnStep } from "@/modules/approvals/server/authorization";

const allowed = (
  ctx: Awaited<ReturnType<typeof requireOrgContext>>,
  key: string,
) => ctx.isAdmin || ctx.permissions.has(key);
export async function accountsData(org: string) {
  const ctx = await requireOrgContext(org);
  const canManage = allowed(ctx, "accounting.manage"),
    canCreate = allowed(ctx, "journal.create"),
    canView = allowed(ctx, "accounting.view");
  if (!canManage && !canCreate && !canView)
    assertPermission(ctx, "accounting.view");
  const [accounts, templates] = await Promise.all([
    db.ledgerAccount.findMany({
      where: { organizationId: ctx.org.id },
      orderBy: [{ code: "asc" }, { id: "asc" }],
    }),
    canManage && (ctx.tenantRole === "OWNER" || ctx.tenantRole === "ADMIN")
      ? db.accountTemplate.findMany({
          where: { tenantId: ctx.tenant.id },
          orderBy: [{ code: "asc" }, { id: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  return {
    ctx,
    accounts,
    templates,
    canManage,
    canManageTemplates:
      canManage && (ctx.tenantRole === "OWNER" || ctx.tenantRole === "ADMIN"),
    canCreate,
    canView,
  };
}
export async function journalsData(org: string, rawParams: ListParams = {}) {
  const ctx = await requireOrgContext(org);
  const canView = allowed(ctx, "accounting.view"),
    canCreate = allowed(ctx, "journal.create"),
    canManage = allowed(ctx, "accounting.manage");
  if (!canView && !canCreate) assertPermission(ctx, "accounting.view");
  const params = listParams(rawParams);
  const where = {
    organizationId: ctx.org.id,
    ...(!canView ? { sourceType: "MANUAL", createdById: ctx.user.id } : {}),
    ...(params.search
      ? {
          OR: [
            { code: { contains: params.search, mode: "insensitive" as const } },
            {
              description: {
                contains: params.search,
                mode: "insensitive" as const,
              },
            },
            {
              creator: {
                name: { contains: params.search, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
  const sortKeys = ["date", "code", "description", "status"];
  const sort = sortKeys.includes(params.sort) ? params.sort : "date";
  const total = await db.journalEntry.count({ where });
  const pagination = pageInfo(total, params);
  const journals = await db.journalEntry.findMany({
    where,
    select: {
      id: true,
      code: true,
      date: true,
      description: true,
      status: true,
      sourceType: true,
      createdById: true,
      creator: { select: { id: true, name: true } },
      reversal: {
        select: { id: true, code: true, date: true, status: true },
      },
      reversalOf: {
        select: { id: true, code: true, date: true, status: true },
      },
    },
    orderBy: [{ [sort]: params.direction }, { code: "desc" }, { id: "desc" }],
    skip: (pagination.page - 1) * pagination.pageSize,
    take: params.take,
  });

  return {
    ctx,
    journals,
    canCreate,
    canManage,
    canView,
    pagination: { ...pagination, sortKeys },
  };
}
export async function journalData(org: string, id: string) {
  const ctx = await requireOrgContext(org);
  const [journal, accounts, projects, parties] = await Promise.all([
    db.journalEntry.findFirst({
      where: { id, organizationId: ctx.org.id },
      include: {
        lines: {
          include: {
            account: true,
            project: { select: { id: true, name: true } },
            party: { select: { id: true, displayName: true } },
          },
          orderBy: { id: "asc" },
        },
        creator: { select: { id: true, name: true } },
        reversal: {
          select: { id: true, code: true, date: true, status: true },
        },
        reversalOf: {
          select: { id: true, code: true, date: true, status: true },
        },
        approvalRequest: {
          include: {
            steps: {
              include: { actedBy: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    db.ledgerAccount.findMany({
      where: { organizationId: ctx.org.id, active: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
    db.project.findMany({
      where: { organizationId: ctx.org.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.party.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);
  if (!journal)
    throw new UserFacingError("Journal not found in this organization.");
  const ownManual =
    journal.sourceType === "MANUAL" && journal.createdById === ctx.user.id;
  const canViewPermission = allowed(ctx, "accounting.view");
  let canApprove = false;
  const request = journal.approvalRequest;
  if (
    request?.documentType === "JOURNAL" &&
    request.organizationId === ctx.org.id
  ) {
    for (const step of request.steps)
      if (await canActOnStep(ctx, step, request)) {
        canApprove = true;
        break;
      }
  }
  if (
    !canViewPermission &&
    !(ownManual && allowed(ctx, "journal.create")) &&
    !canApprove
  )
    assertPermission(ctx, "accounting.view");
  const canManage = allowed(ctx, "accounting.manage");
  const canCreate = allowed(ctx, "journal.create");
  const canEdit =
    journal.status === "DRAFT" &&
    journal.sourceType === "MANUAL" &&
    !journal.reversalOfId &&
    (canManage || (ownManual && canCreate));
  const canSubmit = canEdit && (canManage || canCreate);
  const canReverse =
    journal.status === "POSTED" &&
    journal.sourceType === "MANUAL" &&
    !journal.reversalOfId &&
    !journal.reversal &&
    canManage;
  return {
    ctx,
    journal,
    accounts,
    projects,
    parties,
    canEdit,
    canSubmit,
    canReverse,
    canView: canViewPermission || canManage,
  };
}
