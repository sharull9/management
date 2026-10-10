import { z } from "zod";
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
