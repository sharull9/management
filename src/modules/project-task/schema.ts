import { z } from "zod";
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
export const id = z.string().min(1).max(100);
export const name = z.string().trim().min(1).max(150);
export const text = z.string().trim().max(5000);
export const rate = z
  .string()
  .regex(
    /^\d{1,14}(?:\.\d{1,4})?$/,
    "Enter a nonnegative rate with up to four decimal places.",
  );
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date.",
  )
  .transform((v) => new Date(`${v}T00:00:00Z`));
export const taskInput = z.object({
  title: name,
  description: text,
  stageId: id.nullable(),
  priority: z.enum(TaskPriority),
  estimatedHours: rate.nullable(),
  progressPercent: z.coerce.number().int().min(0).max(100),
  status: z.enum([
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.REWORK,
    TaskStatus.CANCELLED,
  ]),
});
export const taskWorkOperation = z.enum([
  "START",
  "ASSIGN",
  "UNASSIGN",
  "SUBMIT",
  "DELAY",
]);
export const taskSubmissionInput = z.object({
  note: text.min(1),
  progressPercent: z.coerce.number().int().min(0).max(100),
  onBehalfOfWorkerId: id.nullable(),
});
