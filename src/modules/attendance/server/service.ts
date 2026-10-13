import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { costEntryAmounts } from "@/modules/currency/server/cost-entry";
import { resolveProjectRate } from "@/modules/currency/server/rates";
import { audit } from "@/modules/project/server/action-helpers";
import type { attendanceInput } from "../schema";
import { attendanceCost } from "./costing";

export async function attendance(
  org: string,
  projectId: string,
  input: z.output<typeof attendanceInput>,
) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "attendance.record");
  const { date: day, rows } = input;
  if (new Set(rows.map((r) => r.workerId)).size !== rows.length)
    throw new Error("Duplicate worker rows.");
  await db.$transaction(
    async (tx) => {
      if (rows.some((r) => !r.remove)) {
        // Labour is costed in the project currency; its base value needs that
        // currency's rate on the attendance date. Fail once, before any write.
        try {
          await resolveProjectRate(tx, ctx.org.id, projectId, day);
        } catch (error) {
          throw new Error(
            `Cannot record attendance costs for ${day.toISOString().slice(0, 10)}. ${error instanceof Error ? error.message : "Exchange rate unavailable."}`,
          );
        }
      }
      for (const row of rows) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${projectId + row.workerId + day.toISOString()}))::text`;
        const key = { workerId: row.workerId, date: day, projectId };
        if (row.remove) {
          const existing = await tx.attendance.findUnique({
            where: { workerId_date_projectId: key },
          });
          if (existing) {
            const entry = await tx.costEntry.findUnique({
              where: {
                organizationId_sourceType_sourceId: {
                  organizationId: ctx.org.id,
                  sourceType: "ATTENDANCE",
                  sourceId: existing.id,
                },
              },
            });
            if (entry) {
              await tx.costEntry.delete({ where: { id: entry.id } });
              await audit(ctx, tx, "CostEntry", entry.id, "DELETE");
            }
            await tx.attendance.delete({ where: { id: existing.id } });
            await audit(ctx, tx, "Attendance", existing.id, "DELETE");
          }
          continue;
        }
        const assignment = await tx.projectWorker.findFirst({
          where: {
            projectId,
            workerId: row.workerId,
            startDate: { lte: day },
            OR: [{ endDate: null }, { endDate: { gte: day } }],
            worker: { active: true },
          },
          include: { worker: true },
        });
        if (!assignment)
          throw new Error("Worker is inactive or unassigned on this date.");
        const { dayCost, otCost, totalCost } = attendanceCost(
          {
            ...assignment.worker,
            dayRateOverride: assignment.dayRateOverride,
            otHourlyRateOverride: assignment.otHourlyRateOverride,
          },
          row.status,
          row.overtimeHours,
        );
        const fields = {
          status: row.status,
          hoursWorked: row.hoursWorked,
          overtimeHours: row.overtimeHours,
          recordedById: ctx.user.id,
          dayCost,
          otCost,
          totalCost,
        };
        const attendance = await tx.attendance.upsert({
          where: { workerId_date_projectId: key },
          create: { ...key, ...fields, organizationId: ctx.org.id },
          update: fields,
        });
        const cost = {
          organizationId: ctx.org.id,
          projectId,
          date: day,
          costType: "LABOUR" as const,
          // Labour rates are expressed in the project currency.
          ...(await costEntryAmounts(tx, {
            organizationId: ctx.org.id,
            projectId,
            date: day,
            currency: ctx.project.currency,
            amount: totalCost,
          })),
          description: `${assignment.worker.name}: ${row.status}`,
          createdById: ctx.user.id,
        };
        const entry = await tx.costEntry.upsert({
          where: {
            organizationId_sourceType_sourceId: {
              organizationId: ctx.org.id,
              sourceType: "ATTENDANCE",
              sourceId: attendance.id,
            },
          },
          create: {
            ...cost,
            sourceType: "ATTENDANCE",
            sourceId: attendance.id,
          },
          update: cost,
        });
        await audit(ctx, tx, "Attendance", attendance.id, "UPSERT");
        await audit(ctx, tx, "CostEntry", entry.id, "UPSERT");
      }
    },
    { timeout: 30000 },
  );
  return undefined;
}
