"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { NumberField } from "@/components/shared/form/number-field";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { procurementFormSchema } from "../../schema";
import { saveProcurementAction } from "../../server/actions";
import {
  findProcurementChoices,
  findProcurementItems,
  findProcurementProjects,
} from "../../server/picker-actions";
import type { DraftLine, ProcurementFormData } from "../../type";
import { lineDefaults } from "./form-defaults";
import { ProcurementLines } from "./procurement-lines";

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
  const today = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState(data.items);
  const [projects, setProjects] = useState(data.projects);
  const schema = useMemo(() => procurementFormSchema(items), [items]);
  const form = useZodForm(schema, {
    kind,
    id: id ?? null,
    projectId: initialProjectId ?? data.projects[0]?.id ?? null,
    stageId: initial.stageId || null,
    taskId: initial.taskId || null,
    neededBy: initial.neededBy || null,
    vendorPartyId: initial.vendorPartyId || null,
    siteId: initial.siteId || null,
    date: initial.date ?? today,
    receivedDate: initial.receivedDate ?? today,
    paymentTerms:
      (initial.paymentTerms as "CREDIT" | "CASH" | "ADVANCE") ?? "CREDIT",
    paymentDays: Number(initial.paymentDays ?? 0),
    currency:
      initial.currency ??
      data.projects.find(
        (p) => p.id === (initialProjectId ?? data.projects[0]?.id),
      )?.currency ??
      "INR",
    receiptTolerancePercent: Number(initial.receiptTolerancePercent ?? 0),
    poId: initial.poId || null,
    challanNumber: initial.challanNumber ?? "",
    vehicleNumber: initial.vehicleNumber ?? "",
    toProjectId: initial.toProjectId || null,
    lines: (initialLines ?? [undefined]).map(lineDefaults),
  });
  const projectId = useWatch({ control: form.control, name: "projectId" });
  const vendorId = useWatch({ control: form.control, name: "vendorPartyId" });
  const poId = useWatch({ control: form.control, name: "poId" });
  const loadItems = useCallback(
    async (query: string) => {
      if (!projectId) return [];
      const loaded = await findProcurementItems(org, kind, projectId, query);
      setItems((previous) => [
        ...new Map(
          [...previous, ...loaded].map((item) => [item.id, item]),
        ).values(),
      ]);
      return loaded;
    },
    [org, kind, projectId],
  );
  const previousProject = useRef(projectId);
  useEffect(() => {
    if (previousProject.current === projectId) return;
    previousProject.current = projectId;
    form.setValue("poId", null);
    form.setValue("siteId", null);
    form.setValue("stageId", null);
    form.setValue("taskId", null);
    form.setValue("lines", [lineDefaults()]);
    if (!id)
      form.setValue(
        "currency",
        projects.find((p) => p.id === projectId)?.currency ?? "INR",
      );
  }, [projectId, form, projects, id]);
  const loadProjects = useCallback(
    async (query: string) => {
      const loaded = await findProcurementProjects(org, kind, query);
      setProjects((previous) => [
        ...new Map(
          [
            ...previous,
            ...loaded.map((option) => ({
              id: option.value,
              name: option.label,
              currency: option.description ?? "INR",
            })),
          ].map((project) => [project.id, project]),
        ).values(),
      ]);
      return loaded;
    },
    [org, kind],
  );
  const loadDestinations = useCallback(
    async (query: string) =>
      (await loadProjects(query)).filter(
        (option) => option.value !== projectId,
      ),
    [loadProjects, projectId],
  );
  const loaders = useMemo(
    () =>
      Object.fromEntries(
        (["vendors", "sites", "stages", "tasks", "orders"] as const).map(
          (field) => [
            field,
            findProcurementChoices.bind(
              null,
              org,
              kind,
              projectId ?? "",
              field,
            ),
          ],
        ),
      ),
    [org, kind, projectId],
  );
  const scope =
    data.taxSuggestions.find((s) => s.vendorId === vendorId)?.scope ?? "ANY";
  return (
    <ActionFormShell
      form={form}
      action={saveProcurementAction.bind(null, org)}
      submit={
        kind === "consumption"
          ? "Record consumption"
          : id
            ? "Save draft"
            : "Create draft"
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ComboboxField
          control={form.control}
          name="projectId"
          label="Project"
          options={toOptions(projects)}
          loadOptions={loadProjects}
          disabled={!!id}
        />
        {(kind === "requests" || kind === "consumption") && (
          <>
            <ComboboxField
              control={form.control}
              name="stageId"
              label="Stage"
              clearable
              options={toOptions(
                data.stages.filter((s) => s.projectId === projectId),
              )}
              loadOptions={projectId ? loaders.stages : undefined}
              queryKey={["procurement", "stages", org, kind, projectId]}
            />
            <ComboboxField
              control={form.control}
              name="taskId"
              label="Task"
              clearable
              options={toOptions(
                data.tasks.filter((t) => t.projectId === projectId),
              )}
              loadOptions={projectId ? loaders.tasks : undefined}
              queryKey={["procurement", "tasks", org, kind, projectId]}
            />
          </>
        )}
        {kind === "requests" ? (
          <DateField control={form.control} name="neededBy" label="Needed by" />
        ) : (
          <DateField
            control={form.control}
            name={kind === "receipts" ? "receivedDate" : "date"}
            label={kind === "receipts" ? "Received date" : "Date"}
          />
        )}
        {(kind === "orders" || kind === "receipts") && (
          <ComboboxField
            control={form.control}
            name="siteId"
            label="Delivery site"
            clearable
            options={toOptions(
              data.sites.filter((s) => s.projectId === projectId),
            )}
            loadOptions={projectId ? loaders.sites : undefined}
            queryKey={["procurement", "sites", org, kind, projectId]}
          />
        )}
        {kind === "orders" && (
          <>
            <ComboboxField
              control={form.control}
              name="vendorPartyId"
              label="Vendor"
              options={toOptions(data.vendors)}
              loadOptions={projectId ? loaders.vendors : undefined}
              queryKey={["vendors", org, kind, projectId]}
            />
            <ComboboxField
              control={form.control}
              name="paymentTerms"
              label="Payment terms"
              options={[
                { value: "CREDIT", label: "Credit" },
                { value: "CASH", label: "Cash" },
                { value: "ADVANCE", label: "Advance" },
              ]}
            />
            <NumberField
              control={form.control}
              name="paymentDays"
              label="Payment days"
              min={0}
            />
            <TextField
              control={form.control}
              name="currency"
              label="Currency"
            />
            <NumberField
              control={form.control}
              name="receiptTolerancePercent"
              label="Receipt tolerance %"
              min={0}
              max={100}
              step="0.0001"
            />
          </>
        )}
        {kind === "receipts" && (
          <>
            <ComboboxField
              control={form.control}
              name="poId"
              label="Approved purchase order"
              options={toOptions(
                data.orders.filter((o) => o.projectId === projectId),
              )}
              loadOptions={projectId ? loaders.orders : undefined}
              queryKey={["procurement", "orders", org, kind, projectId]}
            />
            <TextField
              control={form.control}
              name="challanNumber"
              label="Challan / delivery note"
            />
            <TextField
              control={form.control}
              name="vehicleNumber"
              label="Vehicle number"
            />
          </>
        )}
        {kind === "transfers" && (
          <ComboboxField
            control={form.control}
            name="toProjectId"
            label="Destination project"
            options={toOptions(projects.filter((p) => p.id !== projectId))}
            loadOptions={loadDestinations}
          />
        )}
      </div>
      {kind === "orders" && (
        <p className="text-sm text-muted-foreground">
          Suggested tax scope: {scope}. Choose the applicable group on each
          line.
        </p>
      )}
      <ProcurementLines
        form={form}
        org={org}
        kind={kind}
        projectId={projectId}
        data={data}
        poId={poId}
        items={items}
        loadItems={loadItems}
      />
    </ActionFormShell>
  );
}
