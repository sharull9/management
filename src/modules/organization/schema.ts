import { z } from "zod";
import { permissionKeys } from "@/core/permissions";
export const name = z.string().trim().min(1, "Name is required.").max(150);
export const id = z.string().min(1).max(100);
export const slug = z
  .string()
  .min(2)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens for the slug.",
  )
  .refine(
    (value) => !["admin", "setup", "sign-in", "api", "_next"].includes(value),
    "This slug is reserved.",
  );
export const credentials = z.object({
  name,
  email: z.email().trim().toLowerCase(),
  password: z
    .string()
    .min(12, "Temporary passwords need at least 12 characters.")
    .max(128),
});
export const orgInput = z.object({
  tenantId: id,
  name,
  slug,
  legalName: z.string().max(200).nullable(),
  baseCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  countryId: id.nullable(),
  stateId: id.nullable(),
  cityId: id.nullable(),
  addressLine1: z.string().max(250).nullable(),
  addressLine2: z.string().max(250).nullable(),
  postalCode: z.string().max(30).nullable(),
});
export const saveMemberInput = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().max(150),
  password: z.string().max(128),
  role: z.enum(["owner", "admin", "member"]),
  roleId: id.nullable(),
});
export const saveRoleInput = z.object({
  name,
  description: z.string().max(500),
  permissions: z.array(
    z.string().refine((p) => permissionKeys.includes(p), "Unknown permission."),
  ),
});
export const saveSeriesInput = z.object({
  type: z
    .string()
    .regex(/^[A-Z_]+$/)
    .max(60),
  prefix: z.string().max(40),
  padding: z.coerce.number().int().min(1).max(12),
  nextNumber: z.coerce.number().int().min(1).max(2147483646),
});
