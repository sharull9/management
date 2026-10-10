"use client";
import { useState } from "react";
import { attendanceCost, type PayTerms } from "@/server/projects/costing";
import { ActionForm, type FormAction } from "./action-form";
import { Field, SelectField } from "./fields";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type Row = {
  workerId: string;
  name: string;
  status: "PRESENT" | "HALF_DAY" | "ABSENT" | "LEAVE";
  hoursWorked: string;
  overtimeHours: string;
  terms: PayTerms;
  remove?: boolean;
};
export function AttendanceGrid({
  initialRows,
  date,
  action,
  currency,
}: {
  initialRows: Row[];
  date: string;
  action: FormAction;
  currency: string;
}) {
  const [rows, setRows] = useState(initialRows);
  function update(workerId: string, fields: Partial<Row>) {
    setRows(
      rows.map((r) => (r.workerId === workerId ? { ...r, ...fields } : r)),
    );
  }
  const totals = rows.map((r) => {
    try {
      return r.remove
        ? "0.00"
        : attendanceCost(
            r.terms,
            r.status,
            r.overtimeHours || "0",
          ).totalCost.toFixed(2);
    } catch {
      return "Invalid";
    }
  });
  return (
    <ActionForm action={action} submit="Save attendance">
      <input type="hidden" name="date" value={date} />
      <input
        type="hidden"
        name="rows"
        value={JSON.stringify(
          rows.map(
            ({ workerId, status, hoursWorked, overtimeHours, remove }) => ({
              workerId,
              status,
              hoursWorked,
              overtimeHours,
              remove,
            }),
          ),
        )}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setRows(
            rows.map((r) => ({
              ...r,
              status: "PRESENT",
              hoursWorked: String(r.terms.standardHoursPerDay),
              remove: false,
            })),
          )
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
          {rows.map((r, i) => (
            <TableRow key={r.workerId}>
              <TableCell>{r.name}</TableCell>
              <TableCell>
                <SelectField
                  label={`${r.name} status`}
                  value={r.status}
                  onChange={(e) =>
                    update(r.workerId, {
                      status: e.target.value as Row["status"],
                    })
                  }
                >
                  {["PRESENT", "HALF_DAY", "ABSENT", "LEAVE"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectField>
              </TableCell>
              <TableCell>
                <Field
                  label={`${r.name} hours`}
                  inputMode="decimal"
                  value={r.hoursWorked}
                  onChange={(e) =>
                    update(r.workerId, { hoursWorked: e.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Field
                  label={`${r.name} OT hours`}
                  inputMode="decimal"
                  value={r.overtimeHours}
                  onChange={(e) =>
                    update(r.workerId, { overtimeHours: e.target.value })
                  }
                />
              </TableCell>
              <TableCell>{totals[i]}</TableCell>
              <TableCell>
                <input
                  type="checkbox"
                  aria-label={`Delete ${r.name} attendance`}
                  checked={r.remove ?? false}
                  onChange={(e) =>
                    update(r.workerId, { remove: e.target.checked })
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && (
        <p className="text-sm text-muted-foreground">
          No workers assigned for this date.
        </p>
      )}
    </ActionForm>
  );
}
