"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { TextField } from "@/components/shared/form/text-field";
import { findCurrencies } from "@/modules/currency/server/picker-actions";
import { type FxPreview, previewDocumentFx } from "../../server/fx-actions";

/** Form values the fields read and write; `date` is the document date. */
type FxValues = { currency: string; exchangeRate: string; date: string };

/**
 * Document currency + exchange rate. The rate is prefilled for the document
 * date whenever the currency or date changes and stays editable; the base
 * currency is fixed at 1. Must render inside a react-hook-form FormProvider.
 */
export function CurrencyFxFields({
  org,
  baseCurrency,
  initialCurrencies = [],
  keepInitialRate = false,
}: {
  org: string;
  baseCurrency: string;
  /** Options so the selected code has a label before searching. */
  initialCurrencies?: string[];
  /** Keep the stored rate on first render (editing an existing draft). */
  keepInitialRate?: boolean;
}) {
  const { control, setValue } = useFormContext<FxValues>();
  const [currency, date] = useWatch({ control, name: ["currency", "date"] });
  const [preview, setPreview] = useState<FxPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const skip = useRef(keepInitialRate);
  const loadCurrencies = useMemo(() => findCurrencies.bind(null, org), [org]);
  useEffect(() => {
    if (!currency || !date) return;
    let current = true;
    previewDocumentFx(org, currency, date)
      .then((result) => {
        if (!current) return;
        setFailed(false);
        setPreview(result);
        if (skip.current) {
          skip.current = false;
          return;
        }
        setValue("exchangeRate", result.exchangeRate ?? "", {
          shouldDirty: true,
        });
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [org, currency, date, setValue]);
  const isBase = currency === baseCurrency;
  const description = isBase
    ? "Base currency."
    : failed
      ? "Unable to look up the rate. Enter it manually."
      : preview?.exchangeRate
        ? `1 ${currency} = ${preview.exchangeRate} ${baseCurrency}${preview.rateDate ? ` (rate dated ${preview.rateDate})` : ""}.`
        : preview
          ? `No ${currency} rate on or before ${date}. Enter one or add it in Settings → Exchange rates.`
          : undefined;
  return (
    <>
      <ComboboxField
        control={control}
        name="currency"
        label="Currency"
        options={[...new Set([baseCurrency, ...initialCurrencies])].map(
          (value) => ({ value, label: value }),
        )}
        loadOptions={loadCurrencies}
      />
      <TextField
        control={control}
        name="exchangeRate"
        label={`Exchange rate | ${baseCurrency} per ${currency || "1 unit"}`}
        inputMode="decimal"
        disabled={isBase}
        description={description}
      />
    </>
  );
}
