"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { Option } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { TextField } from "@/components/shared/form/text-field";
import {
  type ExchangeRatePreview,
  previewExchangeRate,
} from "../../server/fx-actions";
import { findCurrencies } from "../../server/picker-actions";

/** Form values the fields read and write; the date field name is configurable. */
type FxValues = Record<string, string | null | undefined>;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Exchange rate input, prefilled with the dated rate whenever the document
 * currency or date changes. Stays editable (an override applies to this document
 * only); the base currency is fixed at 1. Render inside a react-hook-form
 * FormProvider with `currency`, `exchangeRate` and the date field.
 */
export function ExchangeRateField({
  org,
  baseCurrency,
  dateName = "date",
  keepInitialRate = false,
  disabled = false,
  subject = "document",
}: {
  org: string;
  baseCurrency: string;
  /** Name of the form field holding the document date. */
  dateName?: string;
  /** Keep the stored rate on first render (editing an existing draft). */
  keepInitialRate?: boolean;
  disabled?: boolean;
  /** Noun used in the override hint ("bill", "document"). */
  subject?: string;
}) {
  const { control, setValue } = useFormContext<FxValues>();
  const [currency, date] = useWatch({ control, name: ["currency", dateName] });
  const [preview, setPreview] = useState<ExchangeRatePreview | null>(null);
  const [failed, setFailed] = useState(false);
  const skip = useRef(keepInitialRate);
  useEffect(() => {
    if (!currency || !date || !isoDate.test(date)) return;
    let current = true;
    previewExchangeRate(org, { currency, date })
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
    ? `Base currency (${baseCurrency}); the rate is 1.`
    : failed
      ? "Unable to look up the rate. Enter it manually."
      : preview?.exchangeRate
        ? `1 ${currency} = ${preview.exchangeRate} ${baseCurrency}${preview.rateDate ? ` (rate dated ${preview.rateDate})` : ""}. Editing overrides it for this ${subject} only.`
        : preview
          ? `${preview.error ?? `No ${currency} rate on or before ${date}.`} Enter a rate or add one in Settings → Exchange rates.`
          : undefined;
  return (
    <TextField
      control={control}
      name="exchangeRate"
      label={`Exchange rate | ${baseCurrency} per ${currency || "1 unit"}`}
      inputMode="decimal"
      disabled={disabled || isBase}
      description={description}
    />
  );
}

/**
 * Document currency + exchange rate. `locked` shows the currency read-only (for
 * documents that inherit it from a PO). Must render inside a react-hook-form
 * FormProvider.
 */
export function CurrencyFxFields({
  org,
  baseCurrency,
  initialCurrencies = [],
  currencyOptions,
  dateName,
  keepInitialRate,
  disabled = false,
  locked = false,
  currencyDescription,
  subject,
}: {
  org: string;
  baseCurrency: string;
  /** Codes so the selected value has a label before searching. */
  initialCurrencies?: string[];
  /** Labelled options (e.g. the tenant's enabled currencies). */
  currencyOptions?: Option[];
  dateName?: string;
  keepInitialRate?: boolean;
  disabled?: boolean;
  locked?: boolean;
  currencyDescription?: string;
  subject?: string;
}) {
  const { control } = useFormContext<FxValues>();
  const selected = useWatch({ control, name: "currency" });
  const loadCurrencies = useMemo(() => findCurrencies.bind(null, org), [org]);
  const options = useMemo(() => {
    const known = new Map<string, Option>();
    for (const code of [baseCurrency, ...initialCurrencies, selected ?? ""])
      if (code) known.set(code, { value: code, label: code });
    for (const option of currencyOptions ?? []) known.set(option.value, option);
    return [...known.values()];
  }, [baseCurrency, initialCurrencies, selected, currencyOptions]);
  return (
    <>
      <ComboboxField
        control={control}
        name="currency"
        label="Currency"
        description={currencyDescription}
        options={options}
        loadOptions={locked ? undefined : loadCurrencies}
        queryKey={["currencies", org]}
        disabled={disabled || locked}
      />
      <ExchangeRateField
        org={org}
        baseCurrency={baseCurrency}
        dateName={dateName}
        keepInitialRate={keepInitialRate}
        disabled={disabled}
        subject={subject}
      />
    </>
  );
}
