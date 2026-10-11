import { z } from "zod";
import { ApproverType, DocumentType } from "@/generated/prisma/enums";
export const name = z.string().trim().min(1, "Name is required.").max(150);
export const id = z.string().min(1).max(100);
export const stepSchema = z
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
      .nullable()
      .or(z.literal(""))
      .transform((amount) => amount || null),
  })
  .superRefine((s, ctx) => {
    if (s.approverType === "ROLE" && !s.roleId)
      ctx.addIssue({
        code: "custom",
        path: ["roleId"],
        message: "Select an approver role.",
      });
    if (s.approverType === "USER" && !s.userId)
      ctx.addIssue({
        code: "custom",
        path: ["userId"],
        message: "Select an approver user.",
      });
  });
export const policyScopeInput = z.enum(["org", "project", "stage"]);
export const savePolicyInput = z
  .object({
    id: id.nullable(),
    scope: policyScopeInput,
    projectId: id.nullable(),
    stageId: id.nullable(),
    name,
    documentType: z.enum(DocumentType),
    active: z.boolean(),
    steps: z.array(stepSchema).min(1).max(20),
  })
  .superRefine((policy, ctx) => {
    if (policy.scope !== "org" && !policy.projectId)
      ctx.addIssue({
        code: "custom",
        path: ["projectId"],
        message: "Select a project.",
      });
    if (policy.scope === "stage" && !policy.stageId)
      ctx.addIssue({
        code: "custom",
        path: ["stageId"],
        message: "Select a stage.",
      });
  });
export const approvalDecisionInput = z
  .object({
    stepId: id,
    action: z.enum(["APPROVE", "REJECT"]),
    comment: z.string().max(2000),
  })
  .superRefine((decision, ctx) => {
    if (decision.action === "REJECT" && !decision.comment.trim())
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "A rejection comment is required.",
      });
  });
export const cancelApprovalInput = z.object({ id });
