"use server";

import { type ActionState, runAction } from "@/core/action-result";
import { writeAudit } from "@/core/audit";

import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { optional, value } from "@/core/form-data";
import {
  approvalDecisionInput,
  id,
  policyScopeInput,
  savePolicyInput,
} from "../schema";
import { actOnApproval, cancelApproval } from "./service";
export async function savePolicyAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    assertPermission(ctx, "approval.policy.manage");
    const input = savePolicyInput.parse({
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
    const scope = policyScopeInput.parse(data.get("scope") ?? "org");
    const projectId = scope === "org" ? null : id.parse(data.get("projectId"));
    const stageId = scope === "stage" ? id.parse(data.get("stageId")) : null;
    if (
      projectId &&
      !(await db.project.findFirst({
        where: { id: projectId, organizationId: ctx.org.id },
      }))
    )
      throw new Error("Select a project in this organization.");
    if (
      stageId &&
      !(await db.stage.findFirst({
        where: { id: stageId, projectId: projectId ?? "" },
      }))
    )
      throw new Error("Select a stage in this project.");
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
  });
}
export async function approvalDecisionAction(
  orgSlug: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(orgSlug);
    const input = approvalDecisionInput.parse(Object.fromEntries(data));
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
