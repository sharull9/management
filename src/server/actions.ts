"use server";
import { headers } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { ApproverType, DocumentType } from "@/generated/prisma/enums";
import { auth, createAuth } from "@/lib/auth";
import { permissionKeys } from "@/lib/permissions";
import { type ActionState, runAction } from "./action-result";
import { actOnApproval, cancelApproval } from "./approvals/service";
import { writeAudit } from "./audit";
import {
  assertPermission,
  assertTenantAdmin,
  requireOrgContext,
  requireSuperAdmin,
  requireUser,
} from "./context";
import { db } from "./db";

const name = z.string().trim().min(1, "Name is required.").max(150);
const id = z.string().min(1).max(100);
const slug = z
  .string()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens for the slug.",
  )
  .refine(
    (value) => !["admin", "setup", "sign-in", "api", "_next"].includes(value),
    "This slug is reserved.",
  );
const credentials = z.object({
  name,
  email: z.email().trim().toLowerCase(),
  password: z
    .string()
    .min(12, "Temporary passwords need at least 12 characters.")
    .max(128),
});
const value = (data: FormData, key: string) => String(data.get(key) ?? "");
const optional = (data: FormData, key: string) =>
  value(data, key).trim() || null;
const orgInput = z.object({
  tenantId: id,
  name,
  slug,
  legalName: z.string().max(200).nullable(),
  baseCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  countryId: id.nullable(),
  stateId: id.nullable(),
  cityId: id.nullable(),
  addressLine1: z.string().max(250).nullable(),
  addressLine2: z.string().max(250).nullable(),
  postalCode: z.string().max(30).nullable(),
});

async function provisionUser(
  data: { name: string; email: string; password: string },
  tx: Prisma.TransactionClient,
  actorId: string,
) {
  // No headers permits trusted server-side provisioning in Better Auth 1.7.7.
  // Every caller below checks platform/tenant authorization before reaching here.
  const { user } = await createAuth(tx).api.createUser({
    body: { ...data, role: "user" },
  });
  await writeAudit(
    {
      userId: actorId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
    },
    tx,
  );
  return user;
}
export async function setupAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const input = credentials.parse(Object.fromEntries(data));
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(73194001)::text`;
        if (await tx.user.count())
          throw new Error("Setup is already complete.");
        const { user } = await createAuth(tx).api.createUser({
          body: { ...input, role: "admin" },
        });
        await writeAudit(
          {
            userId: user.id,
            action: "SETUP",
            entityType: "User",
            entityId: user.id,
          },
          tx,
        );
      },
      { timeout: 30000 },
    );
    return "/sign-in";
  });
}
export async function signInAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const input = z
      .object({ email: z.email(), password: z.string().min(1).max(128) })
      .parse(Object.fromEntries(data));
    await auth.api.signInEmail({ body: input, headers: await headers() });
    return "/";
  });
}
export async function signOutAction(_: ActionState, _data: FormData) {
  return runAction(async () => {
    await auth.api.signOut({ headers: await headers() });
    return "/sign-in";
  });
}
export async function createTenantAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const actor = await requireSuperAdmin();
    const input = z
      .object({
        name,
        slug,
        ownerName: name,
        email: z.email().trim().toLowerCase(),
        password: z.string().max(128),
      })
      .parse(Object.fromEntries(data));
    await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: input.email },
      });
      const owner =
        existing ??
        (await provisionUser(
          credentials.parse({
            name: input.ownerName,
            email: input.email,
            password: input.password,
          }),
          tx,
          actor.id,
        ));
      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          members: { create: { userId: owner.id, role: "OWNER" } },
        },
      });
      await writeAudit(
        {
          tenantId: tenant.id,
          userId: actor.id,
          action: "CREATE",
          entityType: "Tenant",
          entityId: tenant.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function tenantStatusAction(_: ActionState, data: FormData) {
  return runAction(async () => {
    const actor = await requireSuperAdmin();
    const input = z
      .object({ tenantId: id, status: z.enum(["ACTIVE", "SUSPENDED"]) })
      .parse(Object.fromEntries(data));
    await db.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: input.tenantId },
        data: { status: input.status },
      });
      await writeAudit(
        {
          tenantId: input.tenantId,
          userId: actor.id,
          action: input.status,
          entityType: "Tenant",
          entityId: input.tenantId,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function saveOrganizationAction(
  orgSlug: string | null,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const user = await requireUser();
    const input = orgInput.parse({
      ...Object.fromEntries(data),
      legalName: optional(data, "legalName"),
      countryId: optional(data, "countryId"),
      stateId: optional(data, "stateId"),
      cityId: optional(data, "cityId"),
      addressLine1: optional(data, "addressLine1"),
      addressLine2: optional(data, "addressLine2"),
      postalCode: optional(data, "postalCode"),
    });
    let currentOrgId: string | undefined;
    if (orgSlug) {
      const ctx = await requireOrgContext(orgSlug);
      assertTenantAdmin(ctx);
      if (ctx.tenant.id !== input.tenantId) throw new Error("Invalid tenant.");
      currentOrgId = ctx.org.id;
    } else {
      const membership = await db.tenantMember.findUnique({
        where: {
          tenantId_userId: { tenantId: input.tenantId, userId: user.id },
        },
        include: { tenant: true },
      });
      if (
        !membership ||
        membership.role === "MEMBER" ||
        membership.tenant.status !== "ACTIVE"
      )
        throw new Error("Tenant administrator access is required.");
    }
    if (
      input.stateId &&
      !(await db.state.findFirst({
        where: { id: input.stateId, countryId: input.countryId ?? "" },
      }))
    )
      throw new Error("Select a state in the selected country.");
    if (
      input.cityId &&
      !(await db.city.findFirst({
        where: {
          id: input.cityId,
          tenantId: input.tenantId,
          stateId: input.stateId ?? "",
        },
      }))
    )
      throw new Error("Select a city in the selected state.");
    const orgId = optional(data, "id");
    const org = await db.$transaction(async (tx) => {
      if (
        orgId &&
        !(await tx.organization.findFirst({
          where: { id: orgId, tenantId: input.tenantId },
        }))
      )
        throw new Error("Organization not found.");
      const saved = orgId
        ? await tx.organization.update({ where: { id: orgId }, data: input })
        : await tx.organization.create({
            data: {
              ...input,
              members: { create: { userId: user.id, role: "owner" } },
            },
          });
      await writeAudit(
        {
          tenantId: input.tenantId,
          organizationId: saved.id,
          userId: user.id,
          action: orgId ? "UPDATE" : "CREATE",
          entityType: "Organization",
          entityId: saved.id,
        },
        tx,
      );
      return saved;
    });
    return !orgSlug || (orgSlug !== org.slug && orgId === currentOrgId)
      ? `/${org.slug}`
      : undefined;
  });
}
export async function saveMemberAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "members.manage");
    const input = z
      .object({
        email: z.email().trim().toLowerCase(),
        name: z.string().max(150),
        password: z.string().max(128),
        role: z.enum(["owner", "admin", "member"]),
        roleId: id.nullable(),
      })
      .parse({ ...Object.fromEntries(data), roleId: optional(data, "roleId") });
    if (!ctx.isAdmin && (input.role !== "member" || input.roleId))
      throw new Error(
        "Only administrators can assign privileged or custom roles.",
      );
    if (
      input.roleId &&
      !(await db.role.findFirst({
        where: { id: input.roleId, tenantId: ctx.tenant.id },
      }))
    )
      throw new Error("Invalid custom role.");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${ctx.org.id} FOR UPDATE`;
      const existing = await tx.user.findUnique({
        where: { email: input.email },
      });
      const user =
        existing ??
        (await provisionUser(credentials.parse(input), tx, ctx.user.id));
      const member = await tx.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.org.id,
            userId: user.id,
          },
        },
      });
      if (
        !ctx.isAdmin &&
        member?.role !== undefined &&
        member.role !== "member"
      )
        throw new Error("Only administrators may edit this member.");
      if (
        member?.role === "owner" &&
        input.role !== "owner" &&
        (await tx.member.count({
          where: { organizationId: ctx.org.id, role: "owner" },
        })) <= 1
      )
        throw new Error("Keep at least one organization owner.");
      await tx.tenantMember.upsert({
        where: {
          tenantId_userId: { tenantId: ctx.tenant.id, userId: user.id },
        },
        create: { tenantId: ctx.tenant.id, userId: user.id, role: "MEMBER" },
        update: {},
      });
      const saved = await tx.member.upsert({
        where: {
          organizationId_userId: {
            organizationId: ctx.org.id,
            userId: user.id,
          },
        },
        create: {
          organizationId: ctx.org.id,
          userId: user.id,
          role: input.role,
          roleId: input.roleId,
        },
        update: { role: input.role, roleId: input.roleId },
      });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "UPSERT",
          entityType: "Member",
          entityId: saved.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function removeMemberAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "members.manage");
    const memberId = id.parse(data.get("id"));
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${ctx.org.id} FOR UPDATE`;
      const member = await tx.member.findFirstOrThrow({
        where: { id: memberId, organizationId: ctx.org.id },
      });
      if (!ctx.isAdmin && (member.role !== "member" || member.roleId))
        throw new Error("Only administrators can remove privileged members.");
      if (
        member.role === "owner" &&
        (await tx.member.count({
          where: { organizationId: ctx.org.id, role: "owner" },
        })) <= 1
      )
        throw new Error("Keep at least one organization owner.");
      await tx.member.delete({ where: { id: member.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "DELETE",
          entityType: "Member",
          entityId: member.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function saveRoleAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "roles.manage");
    const input = z
      .object({
        name,
        description: z.string().max(500),
        permissions: z.array(
          z
            .string()
            .refine((p) => permissionKeys.includes(p), "Unknown permission."),
        ),
      })
      .parse({
        ...Object.fromEntries(data),
        permissions: data.getAll("permissions"),
      });
    const roleId = optional(data, "id");
    if (!ctx.isAdmin && input.permissions.some((p) => !ctx.permissions.has(p)))
      throw new Error("You may only grant permissions you hold.");
    await db.$transaction(async (tx) => {
      if (roleId) {
        const role = await tx.role.findFirstOrThrow({
          where: { id: roleId, tenantId: ctx.tenant.id },
          include: { members: true },
        });
        if (!ctx.isAdmin && role.members.length)
          throw new Error("Only administrators can edit assigned roles.");
      }
      const role = roleId
        ? await tx.role.update({ where: { id: roleId }, data: input })
        : await tx.role.create({ data: { ...input, tenantId: ctx.tenant.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: roleId ? "UPDATE" : "CREATE",
          entityType: "Role",
          entityId: role.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function deleteRoleAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "roles.manage");
    const roleId = id.parse(data.get("id"));
    await db.$transaction(async (tx) => {
      const role = await tx.role.findFirstOrThrow({
        where: { id: roleId, tenantId: ctx.tenant.id },
        include: { members: true },
      });
      if (role.members.length)
        throw new Error("Unassign this role from members before deleting it.");
      await tx.role.delete({ where: { id: role.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "DELETE",
          entityType: "Role",
          entityId: role.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function saveCityAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "masters.manage");
    const input = z
      .object({ name, stateId: id })
      .parse(Object.fromEntries(data));
    const cityId = optional(data, "id");
    await db.$transaction(async (tx) => {
      if (
        cityId &&
        !(await tx.city.findFirst({
          where: { id: cityId, tenantId: ctx.tenant.id },
        }))
      )
        throw new Error("City not found.");
      const city = cityId
        ? await tx.city.update({ where: { id: cityId }, data: input })
        : await tx.city.create({ data: { ...input, tenantId: ctx.tenant.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: cityId ? "UPDATE" : "CREATE",
          entityType: "City",
          entityId: city.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function deleteCityAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "masters.manage");
    const cityId = id.parse(data.get("id"));
    await db.$transaction(async (tx) => {
      const city = await tx.city.findFirstOrThrow({
        where: { id: cityId, tenantId: ctx.tenant.id },
      });
      await tx.city.delete({ where: { id: city.id } });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "DELETE",
          entityType: "City",
          entityId: city.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function saveSeriesAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "settings.manage");
    const input = z
      .object({
        type: z
          .string()
          .regex(/^[A-Z_]+$/)
          .max(60),
        prefix: z.string().max(40),
        padding: z.coerce.number().int().min(1).max(12),
        nextNumber: z.coerce.number().int().min(1).max(2147483646),
      })
      .parse(Object.fromEntries(data));
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`series:${ctx.org.id}:${input.type}`}))::text`;
      await tx.$queryRaw`SELECT id FROM document_series WHERE "organizationId" = ${ctx.org.id} AND type = ${input.type} FOR UPDATE`;
      const existing = await tx.documentSeries.findUnique({
        where: {
          organizationId_type: { organizationId: ctx.org.id, type: input.type },
        },
      });
      if (existing && input.nextNumber < existing.nextNumber)
        throw new Error("The next number cannot move backwards.");
      const series = await tx.documentSeries.upsert({
        where: {
          organizationId_type: { organizationId: ctx.org.id, type: input.type },
        },
        create: { ...input, organizationId: ctx.org.id },
        update: input,
      });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: "UPSERT",
          entityType: "DocumentSeries",
          entityId: series.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
const stepSchema = z
  .object({
    name,
    approverType: z.enum(ApproverType),
    roleId: id.nullable(),
    userId: id.nullable(),
    minAmount: z
      .string()
      .regex(
        /^\d{1,16}(?:\.\d{1,2})?$/,
        "Minimum amount must have at most two decimal places.",
      )
      .nullable(),
  })
  .superRefine((s, ctx) => {
    if (s.approverType === "ROLE" && !s.roleId)
      ctx.addIssue({ code: "custom", message: "Select an approver role." });
    if (s.approverType === "USER" && !s.userId)
      ctx.addIssue({ code: "custom", message: "Select an approver user." });
  });
export async function savePolicyAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "approval.policy.manage");
    const input = z
      .object({
        name,
        documentType: z.enum(DocumentType),
        active: z.boolean(),
        steps: z.array(stepSchema).min(1).max(20),
      })
      .parse({
        ...Object.fromEntries(data),
        active: data.get("active") === "on",
        steps: JSON.parse(value(data, "steps")),
      });
    for (const step of input.steps) {
      if (
        step.approverType === "ROLE" &&
        !(await db.role.findFirst({
          where: { id: step.roleId ?? "", tenantId: ctx.tenant.id },
        }))
      )
        throw new Error("Approver role must belong to this tenant.");
      if (
        step.approverType === "USER" &&
        !(await db.member.findFirst({
          where: { userId: step.userId ?? "", organizationId: ctx.org.id },
        }))
      )
        throw new Error("Approver user must belong to this organization.");
    }
    const policyId = optional(data, "id");
    await db.$transaction(async (tx) => {
      if (
        policyId &&
        !(await tx.approvalPolicy.findFirst({
          where: { id: policyId, organizationId: ctx.org.id },
        }))
      )
        throw new Error("Policy not found.");
      const policyData = {
        name: input.name,
        documentType: input.documentType,
        active: input.active,
        scopeKey: "org",
        projectId: null,
        stageId: null,
      };
      const steps = input.steps.map((s, index) => ({
        ...s,
        roleId: s.approverType === "ROLE" ? s.roleId : null,
        userId: s.approverType === "USER" ? s.userId : null,
        sequence: index + 1,
      }));
      const policy = policyId
        ? await tx.approvalPolicy.update({
            where: { id: policyId },
            data: { ...policyData, steps: { deleteMany: {}, create: steps } },
          })
        : await tx.approvalPolicy.create({
            data: {
              ...policyData,
              organizationId: ctx.org.id,
              steps: { create: steps },
            },
          });
      await writeAudit(
        {
          tenantId: ctx.tenant.id,
          organizationId: ctx.org.id,
          userId: ctx.user.id,
          action: policyId ? "UPDATE" : "CREATE",
          entityType: "ApprovalPolicy",
          entityId: policy.id,
        },
        tx,
      );
    });
    return undefined;
  });
}
export async function approvalDecisionAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    const input = z
      .object({
        stepId: id,
        action: z.enum(["APPROVE", "REJECT"]),
        comment: z.string().max(2000),
      })
      .parse(Object.fromEntries(data));
    if (
      !(await db.approvalRequestStep.findFirst({
        where: { id: input.stepId, request: { organizationId: ctx.org.id } },
      }))
    )
      throw new Error("Step not found.");
    await actOnApproval(input.stepId, input.action, input.comment);
    return undefined;
  });
}
export async function cancelApprovalAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    const requestId = id.parse(data.get("id"));
    if (
      !(await db.approvalRequest.findFirst({
        where: { id: requestId, organizationId: ctx.org.id },
      }))
    )
      throw new Error("Request not found.");
    await cancelApproval(requestId);
    return undefined;
  });
}
