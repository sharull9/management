import { z } from "zod";
import { ProjectStatus } from "@/generated/prisma/enums";
export const id = z.string().min(1).max(100);
export const name = z.string().trim().min(1).max(150);
export const money = z
  .string()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    "Enter a nonnegative amount with up to two decimal places.",
  );
export const stageInput = z.object({
  name,
  sequence: z.coerce.number().int().min(1).max(100000),
  status: z.enum(ProjectStatus),
  managerUserId: id.nullable(),
  budgetAmount: money.nullable(),
});
