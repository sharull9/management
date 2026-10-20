"use client";

import { useEffect } from "react";
import { useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { CheckboxField } from "@/components/shared/form/checkbox-field";
import { enumOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import {
  ASSET_METER_TYPES,
  ASSET_POWER_TYPES,
  ASSET_TYPES,
} from "../../constants";
import { assetInput } from "../../schema";
import { saveAssetAction } from "../../server/actions";

export function AssetForm({
  org,
  baseCurrency,
  asset,
}: {
  org: string;
  baseCurrency: string;
  asset?: z.input<typeof assetInput>;
}) {
  const form = useZodForm<
    z.input<typeof assetInput>,
    z.output<typeof assetInput>
  >(assetInput, {
    id: asset?.id,
    type: asset?.type ?? "VEHICLE",
    meterType: asset?.meterType ?? "KM",
    powerType: asset?.powerType ?? "DIESEL",
    name: asset?.name ?? "",
    code: asset?.code ?? "",
    active: asset?.active ?? true,
    equipmentRatePerMeter: asset?.equipmentRatePerMeter ?? "0.00",
    powerRatingKw: asset?.powerRatingKw ?? null,
    electricityTariff: asset?.electricityTariff ?? null,
  });
  const powerType = useWatch({ control: form.control, name: "powerType" });
  const meterType = useWatch({ control: form.control, name: "meterType" });
  useEffect(() => {
    if (powerType !== "ELECTRIC") {
      form.setValue("powerRatingKw", null);
      form.setValue("electricityTariff", null);
    }
  }, [form, powerType]);
  return (
    <ActionFormShell
      form={form}
      action={saveAssetAction.bind(null, org)}
      submit={asset ? "Save asset" : "Create asset"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name="name"
          label="Asset name"
          required
        />
        <TextField
          control={form.control}
          name="code"
          label="Asset code"
          required
        />
        <ComboboxField
          control={form.control}
          name="type"
          label="Asset type"
          options={enumOptions(
            Object.fromEntries(ASSET_TYPES.map((v) => [v, v])),
          )}
        />
        <ComboboxField
          control={form.control}
          name="meterType"
          label="Meter type"
          options={enumOptions(
            Object.fromEntries(ASSET_METER_TYPES.map((v) => [v, v])),
          )}
        />
        <ComboboxField
          control={form.control}
          name="powerType"
          label="Power type"
          options={enumOptions(
            Object.fromEntries(ASSET_POWER_TYPES.map((v) => [v, v])),
          )}
        />
        <TextField
          control={form.control}
          name="equipmentRatePerMeter"
          label={`Equipment rate (${baseCurrency} per ${meterType === "KM" ? "km" : "hour"})`}
          inputMode="decimal"
          required
        />
        {powerType === "ELECTRIC" && (
          <>
            <TextField
              control={form.control}
              name="powerRatingKw"
              label="Power rating (kW)"
              inputMode="decimal"
              required
            />
            <TextField
              control={form.control}
              name="electricityTariff"
              label={`Electricity tariff (${baseCurrency} per kWh)`}
              inputMode="decimal"
              required
            />
          </>
        )}
        <CheckboxField control={form.control} name="active" label="Active" />
      </div>
    </ActionFormShell>
  );
}
