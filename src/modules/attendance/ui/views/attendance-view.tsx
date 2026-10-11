import { FormCard } from "@/components/shared/form-card";
import { dateValue } from "@/components/shared/form-options";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { readDate } from "@/modules/project/server/queries";
import { attendanceAction } from "../../server/actions";
import { AttendanceDateForm } from "../components/attendance-date-form";
import { AttendanceGrid } from "../components/attendance-grid";
export async function AttendanceView({
  org,
  projectId,
  searchParams,
}: {
  org: string;
  projectId: string;
  searchParams: { date?: string };
}) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "attendance.record");
  const day = readDate(
    searchParams.date,
    new Date(new Date().toISOString().slice(0, 10)),
  );
  const [assignments, saved] = await Promise.all([
    db.projectWorker.findMany({
      where: {
        projectId,
        startDate: { lte: day },
        OR: [{ endDate: null }, { endDate: { gte: day } }],
        worker: { active: true },
      },
      include: { worker: true },
      orderBy: { worker: { name: "asc" } },
    }),
    db.attendance.findMany({
      where: { projectId, date: day },
      include: { worker: true },
    }),
  ]);
  const initialRows = assignments.map((a) => {
    const row = saved.find((s) => s.workerId === a.workerId);
    return {
      workerId: a.workerId,
      name: a.worker.name,
      status: row?.status ?? ("ABSENT" as const),
      hoursWorked: row?.hoursWorked.toString() ?? "0",
      overtimeHours: row?.overtimeHours.toString() ?? "0",
      terms: {
        payType: a.worker.payType,
        salaryAmount: a.worker.salaryAmount.toString(),
        costDaysPerMonth: a.worker.costDaysPerMonth.toString(),
        standardHoursPerDay: a.worker.standardHoursPerDay.toString(),
        overtimeMultiplier: a.worker.overtimeMultiplier.toString(),
        dayRateOverride: a.dayRateOverride?.toString(),
        otHourlyRateOverride: a.otHourlyRateOverride?.toString(),
      },
    };
  });
  const inactiveRows = saved.filter(
    (s) => !assignments.some((a) => a.workerId === s.workerId),
  );
  return (
    <>
      <h2 className="text-lg font-medium">Attendance</h2>
      <AttendanceDateForm
        org={org}
        projectId={projectId}
        defaults={{ date: dateValue(day) }}
      />
      <FormCard title={`Attendance · ${dateValue(day)}`}>
        <AttendanceGrid
          key={dateValue(day)}
          date={dateValue(day)}
          initialRows={initialRows}
          action={attendanceAction.bind(null, org, projectId)}
          currency={ctx.project.currency}
        />
      </FormCard>
      {inactiveRows.length > 0 && (
        <FormCard title="Saved rows for inactive or unassigned workers">
          <AttendanceGrid
            key={dateValue(day)}
            date={dateValue(day)}
            action={attendanceAction.bind(null, org, projectId)}
            currency={ctx.project.currency}
            initialRows={inactiveRows.map((r) => ({
              workerId: r.workerId,
              name: r.worker.name,
              status: r.status,
              hoursWorked: r.hoursWorked.toString(),
              overtimeHours: r.overtimeHours.toString(),
              remove: true,
              terms: {
                payType: r.worker.payType,
                salaryAmount: r.worker.salaryAmount.toString(),
                costDaysPerMonth: r.worker.costDaysPerMonth.toString(),
                standardHoursPerDay: r.worker.standardHoursPerDay.toString(),
                overtimeMultiplier: r.worker.overtimeMultiplier.toString(),
              },
            }))}
          />
        </FormCard>
      )}
    </>
  );
}
