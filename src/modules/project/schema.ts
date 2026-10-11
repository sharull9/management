import { z } from "zod";
import { date } from "@/core/schema";
import { Prisma } from "@/generated/prisma/browser";
import { CostType, ProjectStatus } from "@/generated/prisma/enums";
export const id = z.string().min(1).max(100);
export const name = z.string().trim().min(1).max(150);
export const text = z.string().trim().max(5000);
export const money = z
  .string()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    "Enter a nonnegative amount with up to two decimal places.",
  );
export const projectInput = z.object({
  name,
  description: text,
  status: z.enum(ProjectStatus),
  budgetAmount: money,
  currency: z.string().regex(/^[A-Z]{3}$/),
  clientPartyId: id.nullable(),
  managerUserId: id.nullable(),
});
export const optionalMaterialCostRecognition = z
  .enum(["ON_RECEIPT", "ON_CONSUMPTION"])
  .optional();
export const siteInput = z.object({
  name,
  address: text.min(1),
  pincode: z.string().max(30).nullable(),
  countryId: id.nullable(),
  stateId: id.nullable(),
  cityId: id.nullable(),
});
export const budgetInput = z.object({
  costType: z.enum(CostType),
  stageId: id.nullable(),
  amount: money,
  note: text,
});

export const coordinateInput = (limit: number) =>
  z
    .string()
    .regex(/^-?\d+(?:\.\d{1,7})?$/)
    .refine((v) => new Prisma.Decimal(v).abs().lte(limit))
    .nullable();

export const optionalDate = z
  .union([z.literal(""), date])
  .transform((value) => (value === "" ? null : value));
export const projectFormInput = projectInput
  .extend({
    id: id.nullable(),
    startDate: optionalDate,
    endDate: optionalDate,
    customerName: text.refine(
      (value) => !value || value.length <= 150,
      "Must contain at most 150 characters.",
    ),
    customerLegalName: text.refine(
      (value) => !value || value.length <= 150,
      "Must contain at most 150 characters.",
    ),
    materialCostRecognition: optionalMaterialCostRecognition,
    confirmCostRecognitionChange: z.boolean(),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    { path: ["endDate"], message: "End date must be on or after start date." },
  );
export const deleteInput = z.object({ id });
const optionalCoordinate = (limit: number) =>
  z
    .string()
    .trim()
    .nullable()
    .pipe(z.union([z.literal(""), coordinateInput(limit)]))
    .transform((value) => (value === "" ? null : value));
export const siteFormInput = siteInput.extend({
  id: id.nullable(),
  pincode: z
    .string()
    .trim()
    .max(30)
    .nullable()
    .transform((value) => value || null),
  latitude: optionalCoordinate(90),
  longitude: optionalCoordinate(180),
});
export const totalBudgetInput = z.object({ budgetAmount: money });
export const budgetLineInput = budgetInput.extend({ id: id.nullable() });
export const budgetLinesInput = z.object({
  lines: z.array(budgetInput).min(1).max(100),
});

export const projectFilterInput = z.object({
  search: z.string().max(150),
  status: z.enum(ProjectStatus).nullable(),
});
