import { z } from "zod";
export const name = z.string().trim().min(1).max(150);
export const id = z.string().min(1).max(100);
export const decimal = z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/);
export const entities = [
  "uomGroup",
  "uom",
  "category",
  "level",
  "levelValue",
  "item",
  "party",
  "taxComponent",
  "taxGroup",
  "address",
  "contact",
  "taxIdentifier",
] as const;
export const locationName = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(150);
export const saveCityInput = z.object({ name: locationName, stateId: id });

export const itemLevelSchema = z.coerce.number().int().min(1).max(5);
export const itemTypeSchema = z.enum(["PRODUCT", "SERVICE", "RAW_MATERIAL"]);
export const itemTaxCodeSchema = z.string().max(50).nullable();
export const itemDescriptionSchema = z.string().max(5000).nullable();
export const itemModeSchema = z.enum(["NOT_USED", "ANY", "LINKED"]);
export const partyTypeSchema = z.enum(["BUSINESS", "INDIVIDUAL"]);
export const partyEmailSchema = z.email();
export const partyPhoneSchema = z.string().max(50).nullable();
export const partyPaymentTermsSchema = z.coerce.number().int().min(0).max(3650);
export const partyCreditLimitSchema = z
  .string()
  .regex(/^\d{1,16}(?:\.\d{1,2})?$/);
export const taxAppliesToSchema = z.enum(["PURCHASE", "SALES", "BOTH"]);
export const taxScopeSchema = z.enum(["INTRA", "INTER", "ANY"]);

export const masterKindSchema = z.enum(entities);
