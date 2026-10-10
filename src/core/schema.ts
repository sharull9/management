import { z } from "zod";
import { Decimal } from "./decimal";
export const id = z.string().min(1).max(100);
export const quantity = z
  .string()
  .regex(/^\d{1,14}(?:\.\d{1,4})?$/)
  .refine((v) => new Decimal(v).gt(0), "Quantity must be positive.");
export const rate = z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/);
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
