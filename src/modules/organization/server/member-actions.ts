"use server";

import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { typedAction } from "@/core/typed-action";
import { credentials, recordIdInput, saveMemberInput } from "../schema";
import { hasPrivilegedMemberRole } from "./member-guards";
import { assertNoApprovalAssignments } from "./offboarding-guard";
import { provisionUser } from "./provision-user";
export async function saveMemberAction(
  orgSlug: string,
  input: z.input<typeof saveMemberInput>,
) {
  return typedAction(saveMemberInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "members.manage");
    if (!ctx.isAdmin && (input.role !== "member" || input.roleId))
      throw new UserFacingError(
        "Only administrators can assign privileged or custom roles.",
      );
    if (
      input.roleId &&
      !(await db.role.findFirst({
        where: { id: input.roleId, tenantId: ctx.tenant.id },
      }))
    )
      throw new UserFacingError("Invalid custom role.");
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
        member &&
        hasPrivilegedMemberRole(member.role, member.roleId)
      )
        throw new UserFacingError("Only administrators may edit this member.");
      if (
        member?.role === "owner" &&
        input.role !== "owner" &&
        (await tx.member.count({
          where: { organizationId: ctx.org.id, role: "owner" },
        })) <= 1
      )
        throw new UserFacingError("Keep at least one organization owner.");
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
  })(input);
}
export async function removeMemberAction(
  orgSlug: string,
  input: z.input<typeof recordIdInput>,
) {
  return typedAction(recordIdInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "members.manage");
    const memberId = input.id;
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${ctx.org.id} FOR UPDATE`;
      const member = await tx.member.findFirstOrThrow({
        where: { id: memberId, organizationId: ctx.org.id },
      });
      if (!ctx.isAdmin && hasPrivilegedMemberRole(member.role, member.roleId))
        throw new UserFacingError(
          "Only administrators can remove privileged members.",
        );
      if (
        member.role === "owner" &&
        (await tx.member.count({
          where: { organizationId: ctx.org.id, role: "owner" },
        })) <= 1
      )
        throw new UserFacingError("Keep at least one organization owner.");
      const projectReferences =
        (await tx.projectMember.count({
          where: {
            userId: member.userId,
            project: { organizationId: ctx.org.id },
          },
        })) +
        (await tx.project.count({
          where: { organizationId: ctx.org.id, managerUserId: member.userId },
        })) +
        (await tx.stage.count({
          where: {
            managerUserId: member.userId,
            project: { organizationId: ctx.org.id },
          },
        }));
      if (projectReferences)
        throw new UserFacingError(
          "Remove this member from project teams and manager assignments before removing organization access.",
        );
      const activePolicyAssignments = await tx.approvalPolicyStep.count({
        where: {
          userId: member.userId,
          policy: { organizationId: ctx.org.id, active: true },
        },
      });
      const pendingApprovalAssignments = await tx.approvalRequestStep.count({
        where: {
          userId: member.userId,
          status: { in: ["PENDING", "WAITING"] },
          request: { organizationId: ctx.org.id, status: "PENDING" },
        },
      });
      assertNoApprovalAssignments(
        activePolicyAssignments,
        pendingApprovalAssignments,
      );
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
  })(input);
}
