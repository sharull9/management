import { z } from "zod";
export const name = z.string().trim().min(1, "Name is required.").max(150);
export const credentials = z.object({
  name,
  email: z.email().trim().toLowerCase(),
  password: z
    .string()
    .min(12, "Temporary passwords need at least 12 characters.")
    .max(128),
});
export const signInInput = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});
