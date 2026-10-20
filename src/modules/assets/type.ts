import type { Decimal } from "@/core/decimal";
import type {
  ASSET_METER_TYPES,
  ASSET_POWER_TYPES,
  ASSET_TYPES,
} from "./constants";

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetMeterType = (typeof ASSET_METER_TYPES)[number];
export type AssetPowerType = (typeof ASSET_POWER_TYPES)[number];
export type FuelEfficiency = {
  value: InstanceType<typeof Decimal> | null;
  unit: "km/L" | "L/hr";
  label: "estimate";
};
