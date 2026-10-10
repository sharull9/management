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
      .nullable(),
  })
  .superRefine((s, ctx) => {
    if (s.approverType === "ROLE" && !s.roleId)
      ctx.addIssue({ code: "custom", message: "Select an approver role." });
    if (s.approverType === "USER" && !s.userId)
      ctx.addIssue({ code: "custom", message: "Select an approver user." });
  });
export const savePolicyInput = z.object({
  name,
  documentType: z.enum(DocumentType),
  active: z.boolean(),
  steps: z.array(stepSchema).min(1).max(20),
});
export const policyScopeInput = z.enum(["org", "project", "stage"]);
export const approvalDecisionInput = z.object({
  stepId: id,
  action: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().max(2000),
});
