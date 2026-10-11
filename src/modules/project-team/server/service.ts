import "server-only";
import type { z } from "zod";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { audit, member } from "@/modules/project/server/action-helpers";
import { checkAvailability } from "@/modules/workforce/server/availability";
import type {
  memberInput,
  removeMemberInput,
  removeWorkerInput,
  workerInput,
} from "../schema";

type TeamInput =
  | ({ operation: "MEMBER" } & z.output<typeof memberInput>)
  | ({ operation: "REMOVE_MEMBER" } & z.output<typeof removeMemberInput>)
  | ({ operation: "WORKER" } & z.output<typeof workerInput>)
  | ({ operation: "REMOVE_WORKER" } & z.output<typeof removeWorkerInput>);
export async function team(org: string, projectId: string, data: TeamInput) {
  const ctx = await requireProjectContext(org, projectId);
  assertPermission(ctx, "project.edit");
  await db.$transaction(async (tx) => {
    if (data.operation === "MEMBER" || data.operation === "REMOVE_MEMBER") {
      const userId = data.userId;
      await member(ctx, tx, userId);
      if (data.operation === "REMOVE_MEMBER") {
        const row = await tx.projectMember.findUniqueOrThrow({
          where: { projectId_userId: { projectId, userId } },
        });
        await tx.projectMember.delete({ where: { id: row.id } });
        await audit(ctx, tx, "ProjectMember", row.id, "DELETE");
      } else {
        const roleId = data.roleId;
        if (roleId) {
          const role = await tx.role.findFirstOrThrow({
            where: { id: roleId, tenantId: ctx.tenant.id },
          });
          if (
            !ctx.isAdmin &&
            role.permissions.some((p) => !ctx.permissions.has(p))
          )
            throw new Error("You may only grant permissions you hold.");
        }
        const fields = { roleId, isManager: data.isManager };
        const row = await tx.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, ...fields },
          update: fields,
        });
        await audit(ctx, tx, "ProjectMember", row.id, "UPSERT");
      }
    } else {
      const workerId = data.workerId;
      await tx.$queryRaw`SELECT id FROM workers WHERE id = ${workerId} FOR UPDATE`;
      const worker = await tx.worker.findFirstOrThrow({
        where: { id: workerId, organizationId: ctx.org.id },
      });
      const assignmentId = data.id;
      if (assignmentId)
        await tx.projectWorker.findFirstOrThrow({
          where: { id: assignmentId, projectId, workerId },
        });
      if (data.operation === "REMOVE_WORKER") {
        if (!assignmentId) throw new Error("Assignment is required.");
        if (
          (await tx.projectWorker.count({
            where: { projectId, workerId },
          })) === 1 &&
          (await tx.taskAssignment.count({
            where: {
              workerId,
              task: {
                projectId,
                status: { notIn: ["COMPLETED", "CANCELLED"] },
              },
            },
          }))
        )
          throw new Error(
            "Remove this worker from open tasks before removing their last project assignment.",
          );
        await tx.projectWorker.delete({ where: { id: assignmentId } });
        await audit(ctx, tx, "ProjectWorker", assignmentId, "DELETE");
      } else {
        const range = {
          startDate: data.startDate,
          endDate: data.endDate,
        };
        const assignments = await tx.projectWorker.findMany({
          where: {
            workerId,
            ...(assignmentId ? { id: { not: assignmentId } } : {}),
          },
        });
        checkAvailability(
          worker.active,
          range,
          assignments,
          data.confirmOverlap,
        );
        if (
          assignments.some(
            (a) =>
              a.projectId === projectId &&
              (!a.endDate || range.startDate <= a.endDate) &&
              (!range.endDate || a.startDate <= range.endDate),
          )
        )
          throw new Error(
            "A worker cannot have overlapping rate assignments within the same project.",
          );
        const fields = {
          ...range,
          dayRateOverride: data.dayRateOverride,
          otHourlyRateOverride: data.otHourlyRateOverride,
          notes: data.notes,
        };
        const row = assignmentId
          ? await tx.projectWorker.update({
              where: { id: assignmentId },
              data: fields,
            })
          : await tx.projectWorker.create({
              data: { ...fields, workerId, projectId },
            });
        await audit(
          ctx,
          tx,
          "ProjectWorker",
          row.id,
          assignmentId ? "UPDATE" : "CREATE",
          { overlapConfirmed: data.confirmOverlap },
        );
      }
    }
  });
  return undefined;
}
