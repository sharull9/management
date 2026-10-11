import { z } from "zod";
import { ProjectStatus } from "@/generated/prisma/enums";
import { optionalDate } from "@/modules/project/schema";
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
  sequence: z.number().int().min(1).max(100000),
  status: z.enum(ProjectStatus),
  managerUserId: id.nullable(),
  budgetAmount: money.nullable(),
});

export const stageFormInput = stageInput
  .extend({
    id: id.nullable(),
    startDate: optionalDate,
    endDate: optionalDate,
    budgetAmount: z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), money]))
      .transform((value) => value || null),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    { path: ["endDate"], message: "End date must be on or after start date." },
  );
export const deleteStageInput = z.object({ id });
