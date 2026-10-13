"use client";
import { useCallback, useEffect, useState } from "react";
import { FormProvider, useFieldArray, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox/combobox-field";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { toOptions } from "@/components/shared/form/enum-options";
import { TextField } from "@/components/shared/form/text-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
import { Button } from "@/components/ui/button";
import { CurrencyFxFields } from "@/modules/payment/ui/components/currency-fx-fields";
import { type invoiceFormInput, invoiceFormSchema } from "../../schema";
import { saveInvoiceAction } from "../../server/actions";
import {
  calculateInvoiceLine,
  invoiceTotals,
  suggestSalesTaxScope,
} from "../../server/calculations";
import {
  findInvoiceCustomers,
  findInvoiceItems,
  findInvoiceProjects,
  findInvoiceTaxGroups,
  invoiceCustomerDefaults,
  invoiceTaxGroupDefaults,
} from "../../server/picker-actions";
import type { InvoiceDraftLine, InvoiceFormData } from "../../type";
import { InvoiceLine } from "./invoice-line";

type Input = z.input<typeof invoiceFormInput>;
const emptySelection = {
  itemId: null,
  level1: null,
  level2: null,
  level3: null,
  level4: null,
  level5: null,
};
const blank: Input["lines"][number] = {
  lineType: "SERVICE",
  selection: emptySelection,
  description: "",
  qty: "1",
  uomId: null,
  rate: "0",
  discountPercent: "0",
  taxGroupId: null,
  fromProjectStock: false,
};
function merge<T extends { id: string }>(previous: T[], rows: T[]) {
  return [
    ...new Map([...previous, ...rows].map((row) => [row.id, row])).values(),
  ];
}
function termsDate(terms: number, date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return "";
  value.setUTCDate(value.getUTCDate() + terms);
  return value.toISOString().slice(0, 10);
}
export function InvoiceForm({
  org,
  data,
  initial,
}: {
  org: string;
  data: InvoiceFormData;
  initial?: {
    id?: string;
    projectId?: string | null;
    partyId?: string;
    date?: string;
    dueDate?: string;
    stateId?: string | null;
    currency?: string;
    exchangeRate?: string;
    notes?: string;
    lines?: InvoiceDraftLine[];
  };
}) {
  const [items, setItems] = useState(data.items);
  const [customers, setCustomers] = useState(data.customers);
  const [projects, setProjects] = useState(data.projects);
  const [groups, setGroups] = useState(data.groups);
  const projectId =
    initial?.projectId ??
    (data.allowOrgInvoices ? null : (data.projects[0]?.id ?? null));
  const partyId =
    initial?.partyId ??
    data.projects.find((project) => project.id === projectId)?.clientPartyId ??
    null;
  const customer = data.customers.find((customer) => customer.id === partyId);
  const date = initial?.date ?? new Date().toISOString().slice(0, 10);
  const form = useZodForm(invoiceFormSchema(items), {
    id: initial?.id ?? null,
    projectId,
    partyId,
    date,
    dueDate: initial?.dueDate ?? termsDate(customer?.paymentTerms ?? 0, date),
    stateId: initial?.stateId ?? customer?.stateId ?? null,
    currency:
      initial?.currency ?? customer?.defaultCurrency ?? data.baseCurrency,
    exchangeRate: initial?.exchangeRate ?? "1",
    notes: initial?.notes ?? "",
    lines: initial?.lines?.map(({ itemId, levels, ...line }) => ({
      ...line,
      uomId: line.uomId || null,
      lineType: itemId ? ("GOODS" as const) : ("SERVICE" as const),
      selection: {
        itemId,
        level1: levels[0] ?? null,
        level2: levels[1] ?? null,
        level3: levels[2] ?? null,
        level4: levels[3] ?? null,
        level5: levels[4] ?? null,
      },
    })) ?? [blank],
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });
  const values = useWatch({ control: form.control });
  const lines = useWatch({ control: form.control, name: "lines" });
  const scope = suggestSalesTaxScope(data.orgStateId, values.stateId ?? null);
  const loadCustomers = useCallback(
    async (query: string) => {
      const rows = await findInvoiceCustomers(
        org,
        "sales.invoice.create",
        query,
      );
      setCustomers((previous) =>
        merge(
          previous,
          rows.map((row) => ({
            id: row.value,
            name: row.label,
            stateId: row.stateId,
            paymentTerms: row.paymentTerms,
            defaultCurrency: row.defaultCurrency,
          })),
        ),
      );
      return rows;
    },
    [org],
  );
  const loadProjects = useCallback(
    async (query: string) => {
      const rows = await findInvoiceProjects(
        org,
        "sales.invoice.create",
        query,
      );
      setProjects((previous) =>
        merge(
          previous,
          rows.map((row) => ({
            id: row.value,
            name: row.label,
            clientPartyId: row.clientPartyId,
          })),
        ),
      );
      return rows;
    },
    [org],
  );
  const loadItems = useCallback(
    async (query: string) => {
      const rows = await findInvoiceItems(org, query);
      const ids = [
        ...new Set(
          rows.flatMap((item) =>
            item.defaultTaxGroupId ? [item.defaultTaxGroupId] : [],
          ),
        ),
      ];
      const defaults = ids.length
        ? await invoiceTaxGroupDefaults(org, ids)
        : [];
      setGroups((previous) =>
        merge(
          previous,
          defaults.map((row) => ({
            id: row.value,
            name: row.label,
            scope: row.scope,
            components: row.components,
          })),
        ),
      );
      setItems((previous) => merge(previous, rows));
      return rows;
    },
    [org],
  );
  const loadGroups = useCallback(
    async (query: string) => {
      const rows = await findInvoiceTaxGroups(org, scope, query);
      setGroups((previous) =>
        merge(
          previous,
          rows.map((row) => ({
            id: row.value,
            name: row.label,
            scope: row.scope,
            components: row.components,
          })),
        ),
      );
      return rows;
    },
    [org, scope],
  );
  useEffect(() => {
    const subscription = form.watch(async (_values, { name }) => {
      if (name === "projectId") {
        form.setValue(
          "partyId",
          projects.find((project) => project.id === form.getValues("projectId"))
            ?.clientPartyId ?? null,
        );
      }
      if (name === "partyId") {
        const id = form.getValues("partyId");
        let selected = customers.find((customer) => customer.id === id);
        if (id && !selected) {
          try {
            selected = await invoiceCustomerDefaults(org, id);
            if (form.getValues("partyId") !== id) return;
            const loadedCustomer = selected;
            setCustomers((previous) => merge(previous, [loadedCustomer]));
          } catch {
            form.setError("partyId", {
              message:
                "Unable to load customer defaults. Select the customer again.",
            });
            return;
          }
        }
        form.setValue("stateId", selected?.stateId ?? null);
        if (!form.getValues("id"))
          form.setValue(
            "currency",
            selected?.defaultCurrency ?? data.baseCurrency,
          );
        form.setValue(
          "dueDate",
          termsDate(selected?.paymentTerms ?? 0, form.getValues("date")),
        );
      }
      if (name === "date")
        form.setValue(
          "dueDate",
          termsDate(
            customers.find(
              (customer) => customer.id === form.getValues("partyId"),
            )?.paymentTerms ?? 0,
            form.getValues("date"),
          ),
        );
    });
    return () => subscription.unsubscribe();
  }, [form, projects, customers, org, data.baseCurrency]);
  let preview = "Enter quantities and rates to calculate totals.";
  try {
    const totals = invoiceTotals(
      lines.map((line) =>
        calculateInvoiceLine({
          ...line,
          components:
            groups.find((group) => group.id === line.taxGroupId)?.components ??
            [],
        }),
      ),
    );
    preview = `${values.currency}: Subtotal ${totals.subtotal} / Discount ${totals.discountTotal} / Tax ${totals.taxTotal} / Withholding ${totals.withholdingTotal} / Grand ${totals.grandTotal} / Payable ${totals.payableTotal}`;
  } catch {}
  return (
    <FormProvider {...form}>
      <ActionFormShell
        form={form}
        action={saveInvoiceAction.bind(null, org)}
        submit="Save draft"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ComboboxField
            control={form.control}
            name="projectId"
            label="Project (optional)"
            options={toOptions(projects)}
            loadOptions={loadProjects}
            clearable={data.allowOrgInvoices}
          />
          <ComboboxField
            control={form.control}
            name="partyId"
            label="Customer"
            options={toOptions(customers)}
            loadOptions={loadCustomers}
          />
          <DateField control={form.control} name="date" label="Invoice date" />
          <DateField control={form.control} name="dueDate" label="Due date" />
          <CurrencyFxFields
            org={org}
            baseCurrency={data.baseCurrency}
            initialCurrencies={values.currency ? [values.currency] : []}
            keepInitialRate={!!initial?.id}
          />
          <ComboboxField
            control={form.control}
            name="stateId"
            label="Place of supply"
            options={toOptions(data.states)}
            clearable
          />
          <TextField control={form.control} name="notes" label="Notes" />
        </div>
        <p className="text-sm">
          Suggested tax scope: {scope}. Tax and totals are computed in the
          invoice currency; base totals are converted at the exchange rate.
        </p>
        {fields.map((field, index) => (
          <InvoiceLine
            key={field.id}
            form={form}
            index={index}
            data={{ ...data, items, groups }}
            scope={scope}
            loadItems={loadItems}
            loadGroups={loadGroups}
            remove={() => remove(index)}
            removable={fields.length > 1}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={fields.length >= 100}
          onClick={() => append(blank)}
        >
          Add line
        </Button>
        <p className="text-sm" aria-live="polite">
          {preview}
        </p>
      </ActionFormShell>
    </FormProvider>
  );
}
