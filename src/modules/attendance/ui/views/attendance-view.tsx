import { Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { dateValue } from "@/components/shared/form/date-value";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { readDate } from "@/modules/project/server/queries";
import { attendanceAction } from "../../server/actions";
import { AttendanceDayPicker } from "../components/attendance-day-picker";
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
      <SectionHeader
        title="Attendance"
        description={`${initialRows.length} assigned workers on ${day.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}. Labour is costed in ${ctx.project.currency}.`}
        actions={<AttendanceDayPicker day={dateValue(day)} />}
      />
      <Card>
        <CardContent>
          {initialRows.length > 0 ? (
            <AttendanceGrid
              key={dateValue(day)}
              date={dateValue(day)}
              initialRows={initialRows}
              action={attendanceAction.bind(null, org, projectId)}
              currency={ctx.project.currency}
            />
          ) : (
            <EmptyState
              icon={<Users />}
              title="No workers assigned on this day"
              description="Assign workers to the project to record their attendance."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${org}/projects/${projectId}/team`}>
                    Go to team
                  </Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
      {inactiveRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactive or unassigned workers</CardTitle>
            <CardDescription>
              Saved rows for workers no longer active or assigned on this day.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </>
  );
}
