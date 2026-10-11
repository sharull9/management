"use client";
import { useFieldArray, useWatch } from "react-hook-form";
import type { z } from "zod";
import { ComboboxField } from "@/components/shared/combobox";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ActionFormShell,
  CheckboxField,
  TextField,
  type TypedFormAction,
  useZodForm,
} from "@/components/shared/form";
import { enumOptions } from "@/components/shared/form/enum-options";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AttendanceStatus } from "@/generated/prisma/enums";
import { attendanceInput } from "../../schema";
import { attendanceCost } from "../../server/costing";
import type { AttendanceRow } from "../../type";
export function AttendanceGrid({
  initialRows,
  date,
  action,
  currency,
}: {
  initialRows: AttendanceRow[];
  date: string;
  action: TypedFormAction<z.input<typeof attendanceInput>>;
  currency: string;
}) {
  const form = useZodForm(attendanceInput, {
    date,
    rows: initialRows.map(
      ({ workerId, status, hoursWorked, overtimeHours, remove }) => ({
        workerId,
        status,
        hoursWorked,
        overtimeHours,
        remove: remove ?? false,
      }),
    ),
  });
  const { fields } = useFieldArray({ control: form.control, name: "rows" });
  const rows = useWatch({ control: form.control, name: "rows" });
  const totals = rows.map((r, i) => {
    try {
      return r.remove
        ? "0.00"
        : attendanceCost(
            initialRows[i].terms,
            r.status,
            r.overtimeHours || "0",
          ).totalCost.toFixed(2);
    } catch {
      return "Invalid";
    }
  });
  return (
    <ActionFormShell form={form} action={action} submit="Save attendance">
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          rows.forEach((_, i) => {
            form.setValue(`rows.${i}.status`, "PRESENT", { shouldDirty: true });
            form.setValue(
              `rows.${i}.hoursWorked`,
              String(initialRows[i].terms.standardHoursPerDay),
              { shouldDirty: true },
            );
            form.setValue(`rows.${i}.remove`, false, { shouldDirty: true });
          })
        }
      >
        Mark all present
      </Button>
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Worker",
              "Status",
              "Hours",
              "OT hours",
              `Cost (${currency})`,
              "Delete saved row",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field, i) => {
            const worker = initialRows[i];
            return (
              <TableRow key={field.id}>
                <TableCell>{worker.name}</TableCell>
                <TableCell>
                  <ComboboxField
                    control={form.control}
                    name={`rows.${i}.status`}
                    label={`${worker.name} status`}
                    options={enumOptions(AttendanceStatus)}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    control={form.control}
                    name={`rows.${i}.hoursWorked`}
                    label={`${worker.name} hours`}
                    inputMode="decimal"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    control={form.control}
                    name={`rows.${i}.overtimeHours`}
                    label={`${worker.name} OT hours`}
                    inputMode="decimal"
                  />
                </TableCell>
                <TableCell>{totals[i]}</TableCell>
                <TableCell>
                  <CheckboxField
                    control={form.control}
                    name={`rows.${i}.remove`}
                    label={`Delete ${worker.name} attendance`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!fields.length && (
        <EmptyState title="No workers assigned for this date." />
      )}
    </ActionFormShell>
  );
}
