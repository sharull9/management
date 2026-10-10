"use client";
import { useState } from "react";
import { saveProcurementAction } from "@/server/procurement/actions";
import { ActionForm } from "./action-form";
import { Field, SelectField } from "./fields";
import type { PickerItem } from "./item-picker";
import { type DraftLine, ProcurementLines } from "./procurement-lines";

type Choice = { id: string; name: string; projectId?: string };
export type ProcurementFormData = {
  projects: { id: string; name: string; currency: string }[];
  items: PickerItem[];
  uoms: Choice[];
  vendors: Choice[];
  groups: { id: string; name: string; scope: string }[];
  sites: Choice[];
  stages: Choice[];
  tasks: Choice[];
  taxSuggestions: { vendorId: string; scope: string }[];
  prLines: { id: string; name: string; projectId: string; line: DraftLine }[];
  orders: {
    id: string;
    name: string;
    projectId: string;
    lines: { id: string; name: string; uomId: string; pending: string }[];
  }[];
};
export function ProcurementForm({
  org,
  kind,
  data,
  projectId: initialProjectId,
  id,
  initialLines,
  initial = {},
}: {
  org: string;
  kind: "requests" | "orders" | "receipts" | "consumption" | "transfers";
  data: ProcurementFormData;
  projectId?: string;
  id?: string;
  initialLines?: DraftLine[];
  initial?: Record<string, string>;
}) {
  const [projectId, setProjectId] = useState(
    initialProjectId ?? data.projects[0]?.id ?? "",
  );
  const [vendorId, setVendorId] = useState(initial.vendorPartyId ?? "");
  const [poId, setPoId] = useState(initial.poId ?? "");
  const project = data.projects.find((p) => p.id === projectId);
  const scope =
    data.taxSuggestions.find((s) => s.vendorId === vendorId)?.scope ?? "ANY";
  const options = (rows: Choice[]) =>
    rows.map((r) => (
      <option key={r.id} value={r.id}>
        {r.name}
      </option>
    ));
  const date = new Date().toISOString().slice(0, 10);
  return (
    <ActionForm
      action={saveProcurementAction.bind(null, org)}
      submit={
        kind === "consumption"
          ? "Record consumption"
          : id
            ? "Save draft"
            : "Create draft"
      }
    >
      <input type="hidden" name="kind" value={kind} />
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Project"
          name="projectId"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setPoId("");
          }}
          required
          disabled={!!id}
        >
          <option value="">Select project</option>
          {options(data.projects)}
        </SelectField>
        {id && <input type="hidden" name="projectId" value={projectId} />}
        {(kind === "requests" || kind === "consumption") && (
          <>
            <SelectField
              label="Stage"
              name="stageId"
              defaultValue={initial.stageId ?? ""}
            >
              <option value="">Unallocated</option>
              {options(data.stages.filter((s) => s.projectId === projectId))}
            </SelectField>
            <SelectField
              label="Task"
              name="taskId"
              defaultValue={initial.taskId ?? ""}
            >
              <option value="">Unallocated</option>
              {options(data.tasks.filter((t) => t.projectId === projectId))}
            </SelectField>
          </>
        )}
        {kind === "requests" ? (
          <Field
            label="Needed by"
            name="neededBy"
            type="date"
            defaultValue={initial.neededBy}
          />
        ) : (
          <Field
            label={kind === "receipts" ? "Received date" : "Date"}
            name={kind === "receipts" ? "receivedDate" : "date"}
            type="date"
            defaultValue={initial.date ?? initial.receivedDate ?? date}
            required
          />
        )}
        {(kind === "orders" || kind === "receipts") && (
          <SelectField
            label="Delivery site"
            name="siteId"
            defaultValue={initial.siteId ?? ""}
          >
            <option value="">No site</option>
            {options(data.sites.filter((s) => s.projectId === projectId))}
          </SelectField>
        )}
        {kind === "orders" && (
          <>
            <SelectField
              label="Vendor"
              name="vendorPartyId"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
            >
              <option value="">Select vendor</option>
              {options(data.vendors)}
            </SelectField>
            <SelectField
              label="Payment terms"
              name="paymentTerms"
              defaultValue={initial.paymentTerms ?? "CREDIT"}
            >
              {["CREDIT", "CASH", "ADVANCE"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </SelectField>
            <Field
              label="Payment days"
              name="paymentDays"
              type="number"
              min="0"
              defaultValue={initial.paymentDays ?? "0"}
            />
            <Field
              key={projectId}
              label="Currency"
              name="currency"
              defaultValue={initial.currency ?? project?.currency ?? "INR"}
              required
            />
            <Field
              label="Receipt tolerance %"
              name="receiptTolerancePercent"
              defaultValue={initial.receiptTolerancePercent ?? "0"}
              required
            />
          </>
        )}
        {kind === "receipts" && (
          <>
            <SelectField
              label="Approved purchase order"
              name="poId"
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
              required
            >
              <option value="">Select PO</option>
              {options(data.orders.filter((o) => o.projectId === projectId))}
            </SelectField>
            <Field
              label="Challan / delivery note"
              name="challanNumber"
              defaultValue={initial.challanNumber}
            />
            <Field
              label="Vehicle number"
              name="vehicleNumber"
              defaultValue={initial.vehicleNumber}
            />
          </>
        )}
        {kind === "transfers" && (
          <SelectField
            label="Destination project"
            name="toProjectId"
            defaultValue={initial.toProjectId ?? ""}
            required
          >
            <option value="">Select destination</option>
            {options(data.projects.filter((p) => p.id !== projectId))}
          </SelectField>
        )}
      </div>
      {kind === "orders" && (
        <p className="text-sm text-muted-foreground">
          Suggested tax scope: {scope}. Choose the applicable group on each
          line.
        </p>
      )}
      <ProcurementLines
        key={`${projectId}:${poId}`}
        kind={kind}
        items={data.items}
        uoms={data.uoms}
        groups={data.groups}
        prLines={data.prLines.filter((p) => p.projectId === projectId)}
        poLines={data.orders.find((o) => o.id === poId)?.lines ?? []}
        initialLines={initialLines}
      />
    </ActionForm>
  );
}
