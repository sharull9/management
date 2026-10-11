import { z } from "zod";
import type { PickerItem } from "@/components/shared/form/item-variant-value";
import { variantIdentity } from "@/modules/item-variant/util";
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
const requiredId = id.nullable().transform((value, ctx) => {
  if (value === null) {
    ctx.addIssue({ code: "custom", message: "Select a value." });
    return z.NEVER;
  }
  return value;
});
export const saveCityInput = z.object({
  id: id.optional(),
  name: locationName,
  stateId: requiredId,
});

export const itemLevelSchema = z.number().int().min(1).max(5);
export const itemTypeSchema = z.enum(["PRODUCT", "SERVICE", "RAW_MATERIAL"]);
export const itemTaxCodeSchema = z.string().max(50).nullable();
export const itemDescriptionSchema = z.string().max(5000).nullable();
export const itemModeSchema = z.enum(["NOT_USED", "ANY", "LINKED"]);
export const partyTypeSchema = z.enum(["BUSINESS", "INDIVIDUAL"]);
export const partyEmailSchema = z.email();
export const partyPhoneSchema = z.string().max(50).nullable();
export const partyPaymentTermsSchema = z.number().int().min(0).max(3650);
export const partyCreditLimitSchema = z
  .string()
  .regex(/^\d{1,16}(?:\.\d{1,2})?$/);
export const taxAppliesToSchema = z.enum(["PURCHASE", "SALES", "BOTH"]);
export const taxScopeSchema = z.enum(["INTRA", "INTER", "ANY"]);

export const masterKindSchema = z.enum(entities);

const optionalId = id.nullable().optional();
const optionalText = z.string().optional();
const emailInput = z
  .string()
  .refine(
    (value) => !value.trim() || partyEmailSchema.safeParse(value).success,
    "Invalid email address.",
  )
  .optional();
const masterFields = {
  kind: masterKindSchema,
  id: id.optional(),
  name: optionalText,
  code: optionalText,
  key: optionalText,
  baseCode: optionalText,
  baseName: optionalText,
  groupId: optionalId,
  parentId: optionalId,
  definitionId: optionalId,
  stockUomId: optionalId,
  purchaseUomId: optionalId,
  categoryId: optionalId,
  defaultTaxGroupId: optionalId,
  partyId: optionalId,
  countryId: optionalId,
  stateId: optionalId,
  cityId: optionalId,
  factor: optionalText,
  rate: optionalText,
  creditLimit: optionalText,
  level: itemLevelSchema.optional(),
  paymentTerms: partyPaymentTermsSchema.optional(),
  type: z
    .enum(["PRODUCT", "SERVICE", "RAW_MATERIAL", "BUSINESS", "INDIVIDUAL"])
    .optional(),
  appliesTo: taxAppliesToSchema.optional(),
  scope: taxScopeSchema.optional(),
  taxCode: z.string().trim().max(50).optional(),
  description: z.string().trim().max(5000).optional(),
  legalName: optionalText,
  displayName: optionalText,
  email: emailInput,
  phone: z.string().trim().max(50).optional(),
  label: optionalText,
  value: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  jobTitle: optionalText,
  active: z.boolean().optional(),
  stockTracked: z.boolean().optional(),
  enabled: z.boolean().optional(),
  isBase: z.boolean().optional(),
  isVendor: z.boolean().optional(),
  isCustomer: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  isWithholding: z.boolean().optional(),
  componentIds: z.array(id).optional(),
  mode1: itemModeSchema.optional(),
  required1: z.boolean().optional(),
  links1: z.array(id).optional(),
  mode2: itemModeSchema.optional(),
  required2: z.boolean().optional(),
  links2: z.array(id).optional(),
  mode3: itemModeSchema.optional(),
  required3: z.boolean().optional(),
  links3: z.array(id).optional(),
  mode4: itemModeSchema.optional(),
  required4: z.boolean().optional(),
  links4: z.array(id).optional(),
  mode5: itemModeSchema.optional(),
  required5: z.boolean().optional(),
  links5: z.array(id).optional(),
};
const kindInputs = {
  uomGroup: z.object({ name }),
  uom: z.object({
    groupId: id,
    code: name,
    name,
    factor: decimal,
    isBase: z.boolean(),
  }),
  category: z.object({ name, parentId: optionalId }),
  level: z.object({
    name,
    level: itemLevelSchema,
    enabled: z.boolean(),
  }),
  levelValue: z.object({ name, definitionId: id }),
  item: z.object({
    code: name,
    name,
    type: itemTypeSchema,
    stockUomId: id,
    active: z.boolean(),
    stockTracked: z.boolean(),
  }),
  party: z
    .object({
      code: name,
      legalName: name,
      displayName: name,
      type: partyTypeSchema,
      paymentTerms: partyPaymentTermsSchema,
      creditLimit: partyCreditLimitSchema,
      isVendor: z.boolean(),
      isCustomer: z.boolean(),
    })
    .refine((p) => p.isVendor || p.isCustomer, {
      path: ["isVendor"],
      message: "Select vendor, customer, or both.",
    }),
  address: z.object({
    partyId: id,
    label: name,
    addressLine1: name,
    isDefault: z.boolean(),
  }),
  contact: z.object({ partyId: id, name, isPrimary: z.boolean() }),
  taxIdentifier: z.object({ partyId: id, label: name, value: name }),
  taxComponent: z.object({
    name,
    code: name,
    rate: decimal,
    appliesTo: taxAppliesToSchema,
    isWithholding: z.boolean(),
  }),
  taxGroup: z.object({
    name,
    countryId: optionalId,
    scope: taxScopeSchema,
    componentIds: z.array(id),
  }),
};
export const saveMasterInput = z
  .object(masterFields)
  .superRefine((input, ctx) => {
    const result = kindInputs[input.kind].safeParse(input);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
    if (input.kind === "uomGroup" && !input.id) {
      const result = z
        .object({ key: name, baseCode: name, baseName: name })
        .safeParse(input);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({
            code: "custom",
            path: issue.path,
            message: issue.message,
          });
    }
  });
export const deleteMasterInput = z.object({ kind: masterKindSchema, id });
export const deleteCityInput = z.object({ id });
export const variantSelectionInput = z.object({
  itemId: id.nullable().refine(Boolean, "Select item"),
  level1: id.nullable(),
  level2: id.nullable(),
  level3: id.nullable(),
  level4: id.nullable(),
  level5: id.nullable(),
});
export const resolveVariantInput = z.object({
  selection: variantSelectionInput,
});

export function variantFormInput(items: PickerItem[]) {
  return resolveVariantInput.superRefine(({ selection }, ctx) => {
    const item = items.find((item) => item.id === selection.itemId);
    if (!item) {
      ctx.addIssue({
        code: "custom",
        path: ["selection", "itemId"],
        message: "Select item",
      });
      return;
    }
    try {
      variantIdentity(item, item.configs, [
        selection.level1,
        selection.level2,
        selection.level3,
        selection.level4,
        selection.level5,
      ]);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["selection"],
        message: error instanceof Error ? error.message : "Invalid item levels",
      });
    }
  });
}
