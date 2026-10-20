import { z } from "zod";
import { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
export const MAX_TASK_PHOTO_COUNT = 10;
export const MAX_TASK_PHOTO_BYTES = 900 * 1024;
export const MAX_TASK_PHOTO_TOTAL_BYTES = 900 * 1024;
export const TASK_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function taskPhotoUploadError(
  files: readonly Pick<File, "size" | "type">[],
) {
  if (files.length > MAX_TASK_PHOTO_COUNT)
    return `Upload up to ${MAX_TASK_PHOTO_COUNT} work photos.`;
  if (
    files.some(
      (file) =>
        !TASK_PHOTO_TYPES.includes(
          file.type as (typeof TASK_PHOTO_TYPES)[number],
        ),
    )
  )
    return "Work photos must be JPEG, PNG or WebP.";
  if (files.some((file) => file.size > MAX_TASK_PHOTO_BYTES))
    return "Each work photo must be 900 KB or smaller.";
  if (
    files.reduce((total, file) => total + file.size, 0) >
    MAX_TASK_PHOTO_TOTAL_BYTES
  )
    return "Work photos must total 900 KB or less.";
  return undefined;
}
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

const nullableDateInput = z
  .union([date, z.literal(""), z.null()])
  .transform((v) => (v === "" ? null : v));

export const saveTaskInput = taskInput
  .extend({
    id: id.nullable(),
    progressPercent: z.number().int().min(0).max(100),
    plannedStart: nullableDateInput,
    dueDate: nullableDateInput,
    estimatedHours: z
      .union([rate, z.literal(""), z.null()])
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => !v.plannedStart || !v.dueDate || v.dueDate >= v.plannedStart, {
    path: ["dueDate"],
    message: "End date must be on or after start date.",
  });
export const taskOperationInput = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("START") }),
  z.object({ operation: z.literal("UNASSIGN"), workerId: id }),
  z
    .object({
      operation: z.literal("ASSIGN"),
      workerIds: z
        .array(id)
        .min(1)
        .max(1000)
        .refine((v) => new Set(v).size === v.length, "Duplicate workers."),
      startDate: nullableDateInput,
      endDate: nullableDateInput,
    })
    .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
      path: ["endDate"],
      message: "End date must be on or after start date.",
    }),
  z.object({
    operation: z.literal("DELAY"),
    reason: text.min(1),
    proposedDueDate: date,
  }),
]);
export const taskFiltersInput = z.object({
  search: z.string().max(150),
  status: z.enum(TaskStatus).nullable(),
  stageId: id.nullable(),
});
