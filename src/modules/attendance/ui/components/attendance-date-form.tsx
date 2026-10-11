"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { z } from "zod";
import { ActionFormShell } from "@/components/shared/form/action-form-shell";
import { DateField } from "@/components/shared/form/date-field";
import { useZodForm } from "@/components/shared/form/use-zod-form";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const form = useZodForm(attendanceDateInput, defaults);
  return (
    <ActionFormShell
      form={form}
      className="grid items-end gap-4"
      submit="Load date"
      action={async (input) => {
        const query = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(input))
          if (value) query.set(key, String(value));
          else query.delete(key);
        router.replace(
          `/${org}/projects/${projectId}/attendance?${query.toString()}`,
          { scroll: false },
        );
        return {};
      }}
    >
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <DateField control={form.control} name="date" label="Attendance date" />
      </div>
    </ActionFormShell>
  );
}
