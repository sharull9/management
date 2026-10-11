import { z } from "zod";
import { optionalDate } from "@/modules/project/schema";
export const id = z.string().min(1).max(100);
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
export const teamOperation = z.enum([
  "MEMBER",
  "WORKER",
  "REMOVE_MEMBER",
  "REMOVE_WORKER",
]);

const requiredPickerId = id.nullable().transform((value, ctx) => {
  if (value === null) {
    ctx.addIssue({ code: "custom", message: "Choose an option." });
    return z.NEVER;
  }
  return value;
});
const optionalRate = z
  .string()
  .trim()
  .pipe(z.union([z.literal(""), rate]))
  .transform((value) => value || null);
export const memberInput = z.object({
  userId: requiredPickerId,
  roleId: id.nullable(),
  isManager: z.boolean(),
});
export const removeMemberInput = z.object({ userId: id });
export const removeWorkerInput = z.object({ id, workerId: id });
export const workerInput = z
  .object({
    id: id.nullable(),
    workerId: requiredPickerId,
    startDate: date,
    endDate: optionalDate,
    dayRateOverride: optionalRate,
    otHourlyRateOverride: optionalRate,
    notes: text,
    confirmOverlap: z.boolean(),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    path: ["endDate"],
    message: "End date must be on or after start date.",
  });
