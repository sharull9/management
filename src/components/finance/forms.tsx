"use client";
import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { Button } from "@/components/ui/button";
import {
  allocatePaymentAction,
  recordPaymentAction,
  saveRequestAction,
} from "@/server/payments/actions";

type Document = {
  id: string;
  code: string;
  partyId: string;
  projectId: string | null;
  currency: string;
  outstanding: string;
};
type Request = {
  id: string;
  code: string;
  partyId: string;
  projectId: string | null;
  currency: string;
  mode: string;
  remaining: string;
};
export type FormData = {
  projects: { id: string; name: string; currency: string }[];
  parties: {
    id: string;
    name: string;
    isVendor: boolean;
    isCustomer: boolean;
  }[];
  bills: Document[];
  requests: Request[];
  baseCurrency: string;
  allowOrganization: boolean;
};
export type RequestDraft = {
  id: string;
  partyId: string;
  projectId: string | null;
  date: string;
  amount: string;
  mode: string;
  purpose: string;
  reason: string;
  allocations: { documentId: string; amount: string }[];
};
const modes = ["CASH", "BANK", "UPI", "CHEQUE", "OTHER"];
export function AllocationFields({
  documents,
  values,
  onChange,
}: {
  documents: Document[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="allocations"
        value={JSON.stringify(
          Object.entries(values)
            .filter(([, v]) => v && v !== "0")
            .map(([documentId, amount]) => ({ documentId, amount })),
        )}
      />
      {documents.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No open approved documents for this selection.
        </p>
      )}
      {documents.map((d) => (
        <Field
          key={d.id}
          label={`${d.code} · ${d.currency} ${d.outstanding} outstanding`}
          type="number"
          min="0"
          max={d.outstanding}
          step="0.01"
          value={values[d.id] ?? ""}
          onChange={(e) => onChange({ ...values, [d.id]: e.target.value })}
        />
      ))}
    </div>
  );
}
export function RequestForm({
  org,
  data,
  draft,
}: {
  org: string;
  data: FormData;
  draft?: RequestDraft;
}) {
  const [partyId, setParty] = useState(draft?.partyId ?? ""),
    [projectId, setProject] = useState(
      draft?.projectId ??
        (data.allowOrganization ? "" : (data.projects[0]?.id ?? "")),
    ),
    [purpose, setPurpose] = useState(draft?.purpose ?? "ADVANCE");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      draft?.allocations.map((a) => [a.documentId, a.amount]) ?? [],
    ),
  );
  const currency =
    data.projects.find((p) => p.id === projectId)?.currency ??
    data.baseCurrency;
  return (
    <ActionForm action={saveRequestAction.bind(null, org)} submit="Save draft">
      <input type="hidden" name="id" value={draft?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Vendor"
          name="partyId"
          required
          value={partyId}
          onChange={(e) => {
            setParty(e.target.value);
            setValues({});
          }}
        >
          <option value="">Select vendor</option>
          {data.parties
            .filter((p) => p.isVendor)
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
            setValues({});
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
          type="date"
          name="date"
          required
          defaultValue={draft?.date ?? new Date().toISOString().slice(0, 10)}
        />
        <SelectField
          label="Purpose"
          name="purpose"
          value={purpose}
          onChange={(e) => {
            setPurpose(e.target.value);
            setValues({});
          }}
        >
          {["ADVANCE", "BILL_SETTLEMENT", "OTHER"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </SelectField>
        <SelectField
          label="Mode"
          name="mode"
          defaultValue={draft?.mode ?? "CASH"}
        >
          {modes.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </SelectField>
        <Field
          label={`Amount · ${currency}`}
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={draft?.amount}
        />
      </div>
      <Field
        label="Reason"
        name="reason"
        required
        maxLength={2000}
        defaultValue={draft?.reason}
      />
      {purpose === "BILL_SETTLEMENT" ? (
        <AllocationFields
          documents={data.bills.filter(
            (b) =>
              b.partyId === partyId &&
              b.currency === currency &&
              (!projectId || b.projectId === projectId),
          )}
          values={values}
          onChange={setValues}
        />
      ) : (
        <input type="hidden" name="allocations" value="[]" />
      )}
      {purpose === "BILL_SETTLEMENT" && (
        <p className="text-sm text-muted-foreground">
          Selected bill amounts must equal the request amount.
        </p>
      )}
    </ActionForm>
  );
}
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
export function AllocationForm({
  org,
  paymentId,
  documents,
}: {
  org: string;
  paymentId: string;
  documents: Document[];
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <ActionForm
      action={allocatePaymentAction.bind(null, org)}
      submit="Allocate payment"
    >
      <input type="hidden" name="id" value={paymentId} />
      <AllocationFields
        documents={documents}
        values={values}
        onChange={setValues}
      />
      <Button type="button" variant="outline" onClick={() => setValues({})}>
        Clear amounts
      </Button>
    </ActionForm>
  );
}
