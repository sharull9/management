import { z } from "zod";
import { Decimal } from "@/core/decimal";
import { id } from "@/core/schema";
import { ASSET_METER_TYPES, ASSET_POWER_TYPES, ASSET_TYPES } from "./constants";

const amount = z
  .string()
  .trim()
  .regex(/^\d{1,14}(?:\.\d{1,4})?$/);
const money = z
  .string()
  .trim()
  .regex(/^\d{1,16}(?:\.\d{1,2})?$/);
const timestamp = z.iso.datetime({ offset: true });
const decimalSatisfies = (
  value: string,
  predicate: (value: InstanceType<typeof Decimal>) => boolean,
) => {
  try {
    return predicate(new Decimal(value));
  } catch {
    return false;
  }
};
const date = z.iso.date().refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
});

export const assetInput = z
  .object({
    id: id.optional(),
    type: z.enum(ASSET_TYPES),
    meterType: z.enum(ASSET_METER_TYPES),
    powerType: z.enum(ASSET_POWER_TYPES),
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(40),
    active: z.boolean().default(true),
    equipmentRatePerMeter: money,
    powerRatingKw: amount.nullable().optional(),
    electricityTariff: money.nullable().optional(),
  })
  .superRefine((asset, ctx) => {
    const electric = asset.powerType === "ELECTRIC";
    if (
      electric &&
      (!asset.powerRatingKw ||
        !decimalSatisfies(asset.powerRatingKw, (value) => value.gt(0)))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["powerRatingKw"],
        message: "Enter a positive kW rating for electric assets.",
      });
    }
    if (
      electric &&
      (asset.electricityTariff == null ||
        !decimalSatisfies(asset.electricityTariff, (value) => value.gte(0)))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["electricityTariff"],
        message: "Enter a non-negative electricity tariff for electric assets.",
      });
    }
    if (
      !electric &&
      (asset.powerRatingKw != null || asset.electricityTariff != null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["powerRatingKw"],
        message: "Only electric assets may have electrical specifications.",
      });
    }
  });

export const assetAllocationInput = z
  .object({
    id: id.optional(),
    assetId: id,
    projectId: id,
    startDate: date,
    endDate: date.nullable().optional(),
  })
  .superRefine((allocation, ctx) => {
    if (allocation.endDate && allocation.endDate < allocation.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date.",
      });
  });

const readings = { startReading: amount, endReading: amount };
const readingRange = (
  entry: { startReading: string; endReading: string },
  ctx: z.RefinementCtx,
) => {
  if (new Decimal(entry.endReading).lt(entry.startReading))
    ctx.addIssue({
      code: "custom",
      path: ["endReading"],
      message: "End reading must be on or after start reading.",
    });
};

export const assetTripInput = z
  .object({
    id: id.optional(),
    assetId: id,
    allocationId: id,
    projectId: id,
    outAt: timestamp,
    inAt: timestamp,
    ...readings,
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .superRefine((trip, ctx) => {
    if (Date.parse(trip.inAt) <= Date.parse(trip.outAt))
      ctx.addIssue({
        code: "custom",
        path: ["inAt"],
        message: "Return time must be after departure.",
      });
    readingRange(trip, ctx);
  });

export const assetUsageInput = z
  .object({
    id: id.optional(),
    assetId: id,
    allocationId: id,
    projectId: id,
    startAt: timestamp,
    endAt: timestamp,
    ...readings,
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .superRefine((usage, ctx) => {
    if (Date.parse(usage.endAt) <= Date.parse(usage.startAt))
      ctx.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "Usage duration must be greater than zero.",
      });
    readingRange(usage, ctx);
  });

export const assetFuelLogInput = z.object({
  id: id.optional(),
  assetId: id,
  allocationId: id,
  projectId: id,
  date,
  quantityLitres: amount.refine(
    (value) => decimalSatisfies(value, (decimal) => decimal.gt(0)),
    "Fuel quantity must be greater than zero.",
  ),
  totalCost: money,
  meterReading: amount,
  notes: z.string().trim().max(1000).nullable().optional(),
});
