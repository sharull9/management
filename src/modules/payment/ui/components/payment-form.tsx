"use client";
import { useMemo } from "react";
import { FormProvider, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { TextareaField } from "@/components/shared/form/textarea-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { modes } from "../../constants";
import { paymentInput } from "../../schema";
import { recordPaymentAction } from "../../server/actions";
import { partyDefaultCurrency } from "../../server/fx-actions";
import { findParties, findProjects } from "../../server/picker-actions";
import type { FormData } from "../../type";
import { CurrencyFxFields } from "./currency-fx-fields";
import { PaymentChoice } from "./payment-choice";
export function PaymentForm({
  org,
  data,
  initialRequestId,
}: {
  org: string;
  data: FormData;
  initialRequestId?: string;
}) {
  const initial = data.requests.find((r) => r.id === initialRequestId);
  const form = useZodForm<
    z.input<typeof paymentInput>,
    z.output<typeof paymentInput>
  >(paymentInput, {
    direction: "OUTGOING",
    paymentRequestId: initial?.id ?? null,
    partyId: initial?.partyId ?? "",
    projectId:
      initial?.projectId ??
      (data.allowOrganization ? null : (data.projects[0]?.id ?? null)),
    mode: paymentInput.shape.mode.parse(initial?.mode ?? "BANK"),
    amount: initial?.remaining ?? "",
    currency: initial?.currency ?? data.baseCurrency,
    exchangeRate: initial ? "" : "1",
    date: new Date().toISOString().slice(0, 10),
    reference: "",
    notes: "",
  });
  const [direction, requestId, watchedCurrency] = useWatch({
    control: form.control,
    name: ["direction", "paymentRequestId", "currency"],
  });
  const currency = watchedCurrency ?? data.baseCurrency;
  const parties = useMemo(
    () => findParties.bind(null, org, "payment.record", direction),
    [org, direction],
  );
  const projects = useMemo(
    () => findProjects.bind(null, org, "payment.record"),
    [org],
  );
  const clear = () => form.setValue("paymentRequestId", null);
  const chooseRequest = (id: string | null) => {
    const r = data.requests.find((r) => r.id === id);
    if (r) {
      form.setValue("direction", "OUTGOING");
      form.setValue("partyId", r.partyId);
      form.setValue("projectId", r.projectId);
      form.setValue("currency", r.currency);
      form.setValue("mode", paymentInput.shape.mode.parse(r.mode));
      form.setValue("amount", r.remaining);
    }
  };
  const chooseParty = async (id: string | null) => {
    clear();
    if (!id || form.getValues("paymentRequestId")) return;
    try {
      const code = await partyDefaultCurrency(org, id);
      if (form.getValues("partyId") === id)
        form.setValue("currency", code ?? data.baseCurrency);
    } catch {
      // Keep the current currency; the user can still pick one.
    }
  };
  return (
    <FormProvider {...form}>
      <ActionFormShell
        form={form}
        action={recordPaymentAction.bind(null, org)}
        submit="Record payment"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PaymentChoice
            control={form.control}
            name="direction"
            label="Direction"
            options={[
              { value: "OUTGOING", label: "Outgoing to vendor" },
              { value: "INCOMING", label: "Incoming from customer" },
            ]}
            onChange={() => {
              form.setValue("partyId", "");
              clear();
            }}
          />
          <PaymentChoice
            control={form.control}
            name="paymentRequestId"
            label="Approved payment request"
            options={
              direction === "OUTGOING"
                ? data.requests.map((r) => ({
                    value: r.id,
                    label: `${r.code} | ${r.currency} ${r.remaining}`,
                  }))
                : []
            }
            clearable
            placeholder="Direct payment"
            onChange={chooseRequest}
          />
          <PaymentChoice
            control={form.control}
            name="partyId"
            label={direction === "OUTGOING" ? "Vendor" : "Customer"}
            options={data.parties
              .filter((p) =>
                direction === "OUTGOING" ? p.isVendor : p.isCustomer,
              )
              .map((p) => ({ value: p.id, label: p.name }))}
            loadOptions={parties}
            queryKey={["payment-parties", org, direction]}
            onChange={chooseParty}
          />
          <PaymentChoice
            control={form.control}
            name="projectId"
            label="Project"
            options={data.projects.map((p) => ({
              value: p.id,
              label: p.name,
              description: p.currency,
            }))}
            loadOptions={projects}
            queryKey={["payment-projects", org]}
            clearable={data.allowOrganization}
            placeholder={`Organization | ${data.baseCurrency}`}
            onChange={clear}
          />
          <DateField control={form.control} name="date" label="Date" />
          <PaymentChoice
            control={form.control}
            name="mode"
            label="Mode"
            options={modes.map((value) => ({ value, label: value }))}
            onChange={clear}
          />
          <CurrencyFxFields
            org={org}
            baseCurrency={data.baseCurrency}
            initialCurrencies={[currency]}
          />
          <TextField
            control={form.control}
            name="amount"
            label={`Amount | ${currency}`}
            inputMode="decimal"
            description={
              requestId
                ? `Request remaining: ${data.requests.find((r) => r.id === requestId)?.remaining}`
                : undefined
            }
          />
          <TextField
            control={form.control}
            name="reference"
            label="Reference"
            maxLength={200}
          />
        </div>
        <TextareaField
          control={form.control}
          name="notes"
          label="Notes"
          maxLength={2000}
        />
        <p className="text-sm text-muted-foreground">
          Vendor cash payments require an approved request. Request bill amounts
          allocate automatically. Other payments remain advances until
          allocated.
        </p>
      </ActionFormShell>
    </FormProvider>
  );
}
