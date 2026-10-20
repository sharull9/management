"use server";

import type { z } from "zod";
import { writeAudit } from "@/core/audit";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { UserFacingError } from "@/core/errors";
import { typedAction } from "@/core/typed-action";
import {
  approvalDecisionInput,
  cancelApprovalInput,
  savePolicyInput,
} from "../schema";
import { actOnApproval, cancelApproval } from "./service";
export async function savePolicyAction(
  orgSlug: string,
  input: z.input<typeof savePolicyInput>,
) {
  return typedAction(savePolicyInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "approval.policy.manage");
    const policyId = input.id;
    const projectId = input.scope === "org" ? null : input.projectId;
    const stageId = input.scope === "stage" ? input.stageId : null;
    if (
      projectId &&
      !(await db.project.findFirst({
        where: { id: projectId, organizationId: ctx.org.id },
      }))
    )
      throw new UserFacingError("Select a project in this organization.");
    if (
      stageId &&
      !(await db.stage.findFirst({
        where: { id: stageId, projectId: projectId ?? "" },
      }))
    )
      throw new UserFacingError("Select a stage in this project.");
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${ctx.org.id} FOR UPDATE`;
      for (const step of input.steps) {
        if (
          step.approverType === "ROLE" &&
          !(await tx.role.findFirst({
            where: { id: step.roleId ?? "", tenantId: ctx.tenant.id },
          }))
        )
          throw new UserFacingError(
            "Approver role must belong to this tenant.",
          );
        if (
          step.approverType === "USER" &&
          !(await tx.member.findFirst({
            where: { userId: step.userId ?? "", organizationId: ctx.org.id },
          }))
        )
          throw new UserFacingError(
            "Approver user must belong to this organization.",
          );
      }
      if (
        policyId &&
        !(await tx.approvalPolicy.findFirst({
          where: { id: policyId, organizationId: ctx.org.id },
        }))
      )
        throw new UserFacingError("Policy not found.");
      const policyData = {
        name: input.name,
        documentType: input.documentType,
        active: input.active,
        scopeKey: stageId
          ? `stage:${stageId}`
          : projectId
            ? `project:${projectId}`
            : "org",
        projectId,
        stageId,
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
  })(input);
}
export async function approvalDecisionAction(
  orgSlug: string,
  input: z.input<typeof approvalDecisionInput>,
) {
  return typedAction(approvalDecisionInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    if (
      !(await db.approvalRequestStep.findFirst({
        where: { id: input.stepId, request: { organizationId: ctx.org.id } },
      }))
    )
      throw new UserFacingError("Step not found.");
    await actOnApproval(input.stepId, input.action, input.comment);
    return undefined;
  })(input);
}
export async function cancelApprovalAction(
  orgSlug: string,
  input: z.input<typeof cancelApprovalInput>,
) {
  return typedAction(cancelApprovalInput, async (input) => {
    const ctx = await requireOrgContext(orgSlug);
    const requestId = input.id;
    if (
      !(await db.approvalRequest.findFirst({
        where: { id: requestId, organizationId: ctx.org.id },
      }))
    )
      throw new UserFacingError("Request not found.");
    await cancelApproval(requestId);
    return undefined;
  })(input);
}
