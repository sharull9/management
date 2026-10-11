"use client";
import { useMemo } from "react";
import { FormProvider, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { TextField } from "@/components/shared/form/text-field";
import { TextareaField } from "@/components/shared/form/textarea-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { modes } from "../../constants";
import { requestInput } from "../../schema";
import { saveRequestAction } from "../../server/actions";
import {
  findOpenDocuments,
  findParties,
  findProjects,
} from "../../server/picker-actions";
import type { FormData, RequestDraft } from "../../type";
import { AllocationFields } from "./allocation-form";
import { PaymentChoice } from "./payment-choice";
export function RequestForm({
  org,
  data,
  draft,
}: {
  org: string;
  data: FormData;
  draft?: RequestDraft;
}) {
  const form = useZodForm<
    z.input<typeof requestInput>,
    z.output<typeof requestInput>
  >(requestInput, {
    id: draft?.id ?? null,
    partyId: draft?.partyId ?? "",
    projectId:
      draft?.projectId ??
      (data.allowOrganization ? null : (data.projects[0]?.id ?? null)),
    date: draft?.date ?? new Date().toISOString().slice(0, 10),
    amount: draft?.amount ?? "",
    mode: requestInput.shape.mode.parse(draft?.mode ?? "CASH"),
    purpose: requestInput.shape.purpose.parse(draft?.purpose ?? "ADVANCE"),
    reason: draft?.reason ?? "",
    allocations: draft?.allocations ?? [],
  });
  const [partyId, projectId, purpose] = useWatch({
    control: form.control,
    name: ["partyId", "projectId", "purpose"],
  });
  const currency =
    data.projects.find((p) => p.id === projectId)?.currency ??
    data.baseCurrency;
  const parties = useMemo(
    () => findParties.bind(null, org, "payment.request.create", "OUTGOING"),
    [org],
  );
  const projects = useMemo(
    () => findProjects.bind(null, org, "payment.request.create"),
    [org],
  );
  const documents = useMemo(
    () =>
      findOpenDocuments.bind(
        null,
        org,
        "payment.request.create",
        "OUTGOING",
        partyId ?? "",
        projectId,
        currency,
      ),
    [org, partyId, projectId, currency],
  );
  const clear = () => form.setValue("allocations", []);
  return (
    <FormProvider {...form}>
      <ActionFormShell
        form={form}
        action={saveRequestAction.bind(null, org)}
        submit="Save draft"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PaymentChoice
            control={form.control}
            name="partyId"
            label="Vendor"
            options={data.parties
              .filter((p) => p.isVendor)
              .map((p) => ({ value: p.id, label: p.name }))}
            loadOptions={parties}
            queryKey={["payment-parties", org, "request"]}
            onChange={clear}
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
            queryKey={["payment-projects", org, "request"]}
            clearable={data.allowOrganization}
            placeholder={`Organization | ${data.baseCurrency}`}
            onChange={clear}
          />
          <DateField control={form.control} name="date" label="Date" />
          <PaymentChoice
            control={form.control}
            name="purpose"
            label="Purpose"
            options={["ADVANCE", "BILL_SETTLEMENT", "OTHER"].map((value) => ({
              value,
              label: value.replaceAll("_", " "),
            }))}
            onChange={clear}
          />
          <ComboboxField
            control={form.control}
            name="mode"
            label="Mode"
            options={modes.map((value) => ({ value, label: value }))}
          />
          <TextField
            control={form.control}
            name="amount"
            label={`Amount | ${currency}`}
            inputMode="decimal"
          />
        </div>
        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          maxLength={2000}
        />
        {purpose === "BILL_SETTLEMENT" && (
          <>
            <AllocationFields
              documents={data.bills.filter(
                (b) =>
                  b.partyId === partyId &&
                  b.currency === currency &&
                  (!projectId || b.projectId === projectId),
              )}
              loadOptions={documents}
              selectedOptions={draft?.allocations.map((a) => ({
                value: a.documentId,
                label: a.code ?? a.documentId,
              }))}
            />
            <p className="text-sm text-muted-foreground">
              Selected bill amounts must equal the request amount.
            </p>
          </>
        )}
      </ActionFormShell>
    </FormProvider>
  );
}
