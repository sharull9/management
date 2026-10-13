"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import { Combobox } from "@/components/shared/combobox/combobox";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { EmptyState } from "@/components/shared/empty-state";
import { DateField } from "@/components/shared/form/date-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { FieldFrame } from "@/components/shared/form/field-frame";
import { TextField } from "@/components/shared/form/text-field";
import { TextareaField } from "@/components/shared/form/textarea-field";
import { useActionSubmit } from "@/components/shared/form/use-action-submit";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Decimal } from "@/core/decimal";
import { describeRate } from "@/modules/currency/rate-format";
import {
  type RateSuggestion,
  suggestExchangeRate,
  vendorDefaultCurrency,
} from "@/modules/procurement/server/rate-actions";
import { billFormInput } from "../../schema";
import { saveBillAction } from "../../server/actions";
import { billTotals, calculateBillLine } from "../../server/calculations";
import {
  findBillOrders,
  findBillReceipts,
  findBillTaxGroups,
  findBillVendors,
  getBillOrder,
} from "../../server/picker-actions";
import type { BillDraftLine, BillFormData, BillInitial } from "../../type";
import { billFormData } from "../../util";

export function BillForm({
  org,
  data,
  initial = {},
  initialLines,
}: {
  org: string;
  data: BillFormData;
  initial?: BillInitial;
  initialLines?: BillDraftLine[];
}) {
  const [order, setOrder] = useState(
    data.orders.find((o) => o.id === initial.purchaseOrderId),
  );
  const [vendors, setVendors] = useState(data.vendors);
  const [groups, setGroups] = useState(data.groups);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const orderRequest = useRef(0);
  const blank = (): BillDraftLine => ({
    poLineId: null,
    grnLineId: null,
    itemVariantId: null,
    description: "",
    qty: "1",
    uomId: data.uoms[0]?.id ?? "",
    rate: "0",
    discountPercent: "0",
    taxGroupId: null,
  });
  const today = new Date().toISOString().slice(0, 10);
  const form = useZodForm(billFormInput, {
    attachment: null,
    id: initial.id ?? null,
    projectId:
      initial.projectId ?? order?.projectId ?? data.projects[0]?.id ?? "",
    partyId: initial.partyId ?? order?.partyId ?? vendors[0]?.id ?? "",
    purchaseOrderId: initial.purchaseOrderId || null,
    date: initial.date ?? today,
    vendorInvoiceNo: initial.vendorInvoiceNo ?? "",
    vendorInvoiceDate: initial.vendorInvoiceDate ?? initial.date ?? today,
    dueDate: initial.dueDate || null,
    currency:
      initial.currency ??
      order?.currency ??
      vendors.find((v) => v.id === initial.partyId)?.defaultCurrency ??
      data.baseCurrency,
    exchangeRate: initial.exchangeRate ?? "",
    notes: initial.notes ?? "",
    lines: initialLines ?? order?.lines ?? [blank()],
  });
  const { fields, append, remove, replace, update } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const values = useWatch({ control: form.control });
  const [rateInfo, setRateInfo] = useState<RateSuggestion | null>(null);
  // A saved draft keeps its own rate until its currency or date is changed.
  const keepSavedRate = useRef(!!initial.exchangeRate);
  const previousVendor = useRef(values.partyId);
  const currency = values.currency ?? data.baseCurrency;
  const isForeign = currency !== data.baseCurrency;
  useEffect(() => {
    const vendorId = values.partyId;
    if (!vendorId || previousVendor.current === vendorId) return;
    previousVendor.current = vendorId;
    if (values.purchaseOrderId) return;
    let stale = false;
    vendorDefaultCurrency(org, vendorId)
      .then((code) => {
        if (!stale && code && data.currencies.some((c) => c.code === code))
          form.setValue("currency", code, { shouldDirty: true });
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [values.partyId, values.purchaseOrderId, org, form, data.currencies]);
  useEffect(() => {
    const date = values.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let stale = false;
    suggestExchangeRate(org, { currency, date })
      .then((suggestion) => {
        if (stale) return;
        setRateInfo(suggestion);
        if (keepSavedRate.current) {
          keepSavedRate.current = false;
          return;
        }
        form.setValue("exchangeRate", suggestion.rate ?? "", {
          shouldDirty: true,
        });
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [org, currency, values.date, form]);
  const loaders = useMemo(
    () => ({
      vendors: findBillVendors.bind(null, org, "bill.create"),
      groups: findBillTaxGroups.bind(null, org),
      orders: findBillOrders.bind(null, org),
      receipts: findBillReceipts.bind(
        null,
        org,
        values.purchaseOrderId ?? "",
        initial.id ?? null,
      ),
    }),
    [org, values.purchaseOrderId, initial.id],
  );
  const { onSubmit, pending, state } = useActionSubmit(
    form,
    ({ attachment, ...input }) =>
      saveBillAction(org, billFormData(input, attachment)),
  );
  async function selectOrder(value: string | null) {
    const request = ++orderRequest.current;
    form.setValue("purchaseOrderId", value);
    form.clearErrors();
    if (!value) {
      setOrder(undefined);
      replace([blank()]);
      setLoadingOrder(false);
      return;
    }
    setLoadingOrder(true);
    try {
      const selected = await getBillOrder(org, initial.id ?? null, value);
      if (request !== orderRequest.current) return;
      setOrder(selected.order);
      setVendors(selected.vendors);
      setGroups(selected.groups);
      form.setValue("projectId", selected.order.projectId);
      form.setValue("partyId", selected.order.partyId);
      form.setValue("currency", selected.order.currency, { shouldDirty: true });
      form.setValue("dueDate", null);
      replace(selected.order.lines);
    } catch {
      if (request !== orderRequest.current) return;
      form.setValue("purchaseOrderId", order?.id ?? null);
      form.setError("purchaseOrderId", {
        message: "Unable to load purchase order. Please try again.",
      });
    } finally {
      if (request === orderRequest.current) setLoadingOrder(false);
    }
  }
  let netPreview = "";
  try {
    netPreview = billTotals(
      (values.lines ?? []).map((l) =>
        calculateBillLine(
          {
            qty: l.qty ?? "",
            rate: l.rate ?? "",
            discountPercent: l.discountPercent ?? "",
          },
          [],
        ),
      ),
    ).grandTotal.toFixed(2);
  } catch {}
  const busy = pending || loadingOrder;
  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4 border-0 p-0">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldFrame
            control={form.control}
            name="purchaseOrderId"
            label="Purchase order"
          >
            {(field, accessibility) => (
              <Combobox
                {...accessibility}
                ref={field.ref}
                onBlur={field.onBlur}
                value={typeof field.value === "string" ? field.value : null}
                onChange={selectOrder}
                options={order ? [{ value: order.id, label: order.name }] : []}
                loadOptions={loaders.orders}
                queryKey={["bill-orders", org]}
                clearable
                disabled={busy}
                placeholder="Direct bill (services / no PO)"
              />
            )}
          </FieldFrame>
          <ComboboxField
            control={form.control}
            name="projectId"
            label="Project"
            options={toOptions(data.projects)}
            disabled={busy || !!values.purchaseOrderId}
          />
          <ComboboxField
            control={form.control}
            name="partyId"
            label="Vendor"
            options={toOptions(vendors)}
            loadOptions={loaders.vendors}
            queryKey={["vendors", org, "bill"]}
            disabled={busy || !!values.purchaseOrderId}
          />
          <ComboboxField
            control={form.control}
            name="currency"
            label="Currency"
            description={
              values.purchaseOrderId
                ? "Fixed to the purchase order's currency."
                : undefined
            }
            options={data.currencies.map((c) => ({
              value: c.code,
              label: `${c.code} | ${c.name}`,
            }))}
            disabled={busy || !!values.purchaseOrderId}
          />
          <TextField
            control={form.control}
            name="exchangeRate"
            label={`Exchange rate (${data.baseCurrency} per ${currency})`}
            description={
              !isForeign
                ? `Base currency (${data.baseCurrency}); the rate is 1.`
                : rateInfo?.error
                  ? rateInfo.error
                  : rateInfo?.rateDate && values.exchangeRate
                    ? `${describeRate(currency, data.baseCurrency, values.exchangeRate)}. Latest dated rate: ${rateInfo.rateDate}. Editing overrides it for this bill only.`
                    : undefined
            }
            inputMode="decimal"
            disabled={busy || !isForeign}
          />
          <TextField
            control={form.control}
            name="vendorInvoiceNo"
            label="Vendor invoice number"
            required
            maxLength={200}
          />
          <DateField
            control={form.control}
            name="vendorInvoiceDate"
            label="Vendor invoice date"
          />
          <DateField control={form.control} name="date" label="Bill date" />
          <DateField
            control={form.control}
            name="dueDate"
            label="Due date"
            description="Leave blank to use the vendor's payment terms from the bill date."
          />
          <TextareaField
            control={form.control}
            name="notes"
            label="Notes"
            maxLength={4000}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          PO quantities show received amounts remaining after all non-cancelled
          bills. Amounts are in {currency}; variance against receipts is posted
          in {data.baseCurrency}. Duplicate vendor invoice numbers are blocked.
        </p>
        {fields.map((field, i) => {
          const line = values.lines?.[i];
          const receipt = order?.lines.find(
            (l) =>
              l.grnLineId === line?.grnLineId && l.poLineId === line?.poLineId,
          );
          const selectedReceipt =
            receipt ??
            initialLines?.find(
              (l) =>
                l.grnLineId === line?.grnLineId &&
                l.poLineId === line?.poLineId,
            );
          return (
            <div className="space-y-3 rounded-md border p-4" key={field.id}>
              {receipt && (
                <p className="text-sm">
                  PO rate: {receipt.poRate}. Available quantity: {receipt.qty}
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                {values.purchaseOrderId ? (
                  <FieldFrame
                    control={form.control}
                    name={`lines.${i}.grnLineId`}
                    label="GRN receipt"
                  >
                    {(rhf, accessibility) => (
                      <Combobox
                        {...accessibility}
                        ref={rhf.ref}
                        onBlur={rhf.onBlur}
                        value={typeof rhf.value === "string" ? rhf.value : null}
                        options={
                          selectedReceipt?.grnLineId
                            ? [
                                {
                                  value: selectedReceipt.grnLineId,
                                  label: `${selectedReceipt.receiptName ?? "Receipt"} / ${selectedReceipt.description}`,
                                },
                              ]
                            : []
                        }
                        loadOptions={loaders.receipts}
                        disabled={busy}
                        onChange={(id) => {
                          const replacement = order?.lines.find(
                            (l) => l.grnLineId === id,
                          );
                          if (replacement) update(i, replacement);
                          else
                            form.setError(`lines.${i}.grnLineId`, {
                              message: "This receipt has no billable quantity.",
                            });
                        }}
                      />
                    )}
                  </FieldFrame>
                ) : (
                  <ComboboxField
                    control={form.control}
                    name={`lines.${i}.itemVariantId`}
                    label="Item variant (optional for services)"
                    options={toOptions(data.variants)}
                    clearable
                    disabled={busy}
                  />
                )}
                <TextField
                  control={form.control}
                  name={`lines.${i}.description`}
                  label="Description"
                  required
                  maxLength={1000}
                />
                <TextField
                  control={form.control}
                  name={`lines.${i}.qty`}
                  label="Quantity"
                  inputMode="decimal"
                  required
                />
                <ComboboxField
                  control={form.control}
                  name={`lines.${i}.uomId`}
                  label="Unit"
                  options={toOptions(data.uoms)}
                  disabled={busy || !!values.purchaseOrderId}
                />
                <TextField
                  control={form.control}
                  name={`lines.${i}.rate`}
                  label="Billed rate"
                  inputMode="decimal"
                  required
                />
                <TextField
                  control={form.control}
                  name={`lines.${i}.discountPercent`}
                  label="Discount %"
                  inputMode="decimal"
                  required
                />
                <ComboboxField
                  control={form.control}
                  name={`lines.${i}.taxGroupId`}
                  label="Tax group"
                  options={toOptions(groups)}
                  loadOptions={loaders.groups}
                  queryKey={["tax-groups", org, "bill"]}
                  clearable
                  disabled={busy}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => remove(i)}>
                Remove line
              </Button>
            </div>
          );
        })}
        {!values.purchaseOrderId && (
          <Button
            type="button"
            variant="outline"
            onClick={() => append(blank())}
          >
            Add line
          </Button>
        )}
        {!fields.length && (
          <EmptyState
            title="No billable lines."
            description="Select another PO or create a direct bill."
          />
        )}
        {form.formState.errors.lines?.message && (
          <p role="alert" className="text-sm text-destructive">
            {form.formState.errors.lines.message}
          </p>
        )}
        {netPreview && (
          <p>
            Net amount before tax: {netPreview} {currency}
            {isForeign && values.exchangeRate
              ? ` ≈ ${new Decimal(netPreview).mul(values.exchangeRate).toFixed(2)} ${data.baseCurrency}`
              : ""}
            . Tax and withholding snapshots are calculated when saved.
          </p>
        )}
        <FieldFrame
          control={form.control}
          name="attachment"
          label="Vendor invoice copy (PDF, PNG or JPEG, max 900 KB)"
        >
          {(field, accessibility) => (
            <Input
              {...accessibility}
              ref={field.ref}
              onBlur={field.onBlur}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(event) =>
                field.onChange(event.target.files?.[0] ?? null)
              }
            />
          )}
        </FieldFrame>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {loadingOrder
            ? "Loading order..."
            : pending
              ? "Saving..."
              : initial.id
                ? "Save draft"
                : "Create bill"}
        </Button>
      </fieldset>
    </form>
  );
}
