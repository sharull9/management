import { z } from "zod";
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
export const createTenantInput = z.object({
  name,
  slug,
  ownerName: name,
  email: z.email().trim().toLowerCase(),
  password: z.string().max(128),
});
export const tenantStatusInput = z.object({
  tenantId: id,
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
