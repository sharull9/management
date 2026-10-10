"use client";
import { useState } from "react";
import { ActionForm } from "@/components/shared/action-form";
import { Field, SelectField } from "@/components/shared/fields";
import { modes } from "../../constants";
import { saveRequestAction } from "../../server/actions";
import type { FormData, RequestDraft } from "../../type";
import { AllocationFields } from "./allocation-form";
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
