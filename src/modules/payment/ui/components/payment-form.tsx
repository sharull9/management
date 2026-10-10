"use client";
import { useState } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { modes } from "../../constants";
import { recordPaymentAction } from "../../server/actions";
import type { FormData } from "../../type";
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
  const [requestId, setRequest] = useState(initial?.id ?? ""),
    [direction, setDirection] = useState("OUTGOING"),
    [partyId, setParty] = useState(initial?.partyId ?? ""),
    [projectId, setProject] = useState(
      initial?.projectId ??
        (data.allowOrganization ? "" : (data.projects[0]?.id ?? "")),
    ),
    [mode, setMode] = useState(initial?.mode ?? "BANK"),
    [value, setValue] = useState(initial?.remaining ?? "");
  const request = data.requests.find((r) => r.id === requestId);
  const currency =
    data.projects.find((p) => p.id === projectId)?.currency ??
    data.baseCurrency;
  const chooseRequest = (id: string) => {
    setRequest(id);
    const r = data.requests.find((r) => r.id === id);
    if (r) {
      setDirection("OUTGOING");
      setParty(r.partyId);
      setProject(r.projectId ?? "");
      setMode(r.mode);
      setValue(r.remaining);
    }
  };
  return (
    <ActionForm
      action={recordPaymentAction.bind(null, org)}
      submit="Record payment"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Direction"
          name="direction"
          value={direction}
          onChange={(e) => {
            setDirection(e.target.value);
            setParty("");
            setRequest("");
          }}
        >
          <option value="OUTGOING">Outgoing to vendor</option>
          <option value="INCOMING">Incoming from customer</option>
        </SelectField>
        <SelectField
          label="Approved payment request"
          name="paymentRequestId"
          value={requestId}
          onChange={(e) => chooseRequest(e.target.value)}
        >
          <option value="">Direct payment</option>
          {direction === "OUTGOING" &&
            data.requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.currency} {r.remaining}
              </option>
            ))}
        </SelectField>
        <SelectField
          label={direction === "OUTGOING" ? "Vendor" : "Customer"}
          name="partyId"
          required
          value={partyId}
          onChange={(e) => {
            setParty(e.target.value);
            setRequest("");
          }}
        >
          <option value="">Select party</option>
          {data.parties
            .filter((p) =>
              direction === "OUTGOING" ? p.isVendor : p.isCustomer,
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </SelectField>
        <SelectField
          label="Project"
          name="projectId"
          value={projectId}
          onChange={(e) => {
            setProject(e.target.value);
            setRequest("");
          }}
        >
          {data.allowOrganization && (
            <option value="">Organization · {data.baseCurrency}</option>
          )}
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.currency}
            </option>
          ))}
        </SelectField>
        <Field
          label="Date"
          name="date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
        <SelectField
          label="Mode"
          name="mode"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setRequest("");
          }}
        >
          {modes.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </SelectField>
        <Field
          label={`Amount · ${currency}`}
          name="amount"
          type="number"
          min="0.01"
          max={request?.remaining}
          step="0.01"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Field label="Reference" name="reference" maxLength={200} />
      </div>
      <Field label="Notes" name="notes" maxLength={2000} />
      <p className="text-sm text-muted-foreground">
        Vendor cash payments require an approved request. Request bill amounts
        allocate automatically. Other payments remain advances until allocated.
      </p>
    </ActionForm>
  );
}
