"use client";
import type { z } from "zod";
import {
  ActionFormShell,
  DateField,
  useZodForm,
} from "@/components/shared/form";
import { attendanceDateInput } from "../../schema";
export function AttendanceDateForm({
  org,
  projectId,
  defaults,
}: {
  org: string;
  projectId: string;
  defaults: z.input<typeof attendanceDateInput>;
}) {
  const form = useZodForm(attendanceDateInput, defaults);
  return (
    <ActionFormShell
      form={form}
      className="grid items-end gap-4"
      submit="Load date"
      action={async (input) => {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(input))
          if (value) query.set(key, String(value));
        return {
          redirectTo: `/${org}/projects/${projectId}/attendance?${query.toString()}`,
        };
      }}
    >
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <DateField control={form.control} name="date" label="Attendance date" />
      </div>
    </ActionFormShell>
  );
}
