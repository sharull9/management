import "server-only";
import { type ActionState, runAction } from "@/core/action-result";
import { assertPermission, requireProjectContext } from "@/core/context";
import { db } from "@/core/db";
import { optional, value } from "@/core/form-data";
import { audit, member, nullableDate } from "@/modules/project";
import { checkAvailability } from "@/modules/workforce";
import { date, id, rate, teamOperation, text } from "../schema";

export async function team(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "project.edit");
    const operation = teamOperation.parse(data.get("operation"));
    await db.$transaction(async (tx) => {
      if (operation === "MEMBER" || operation === "REMOVE_MEMBER") {
        const userId = id.parse(data.get("userId"));
        await member(ctx, tx, userId);
        if (operation === "REMOVE_MEMBER") {
          const row = await tx.projectMember.findUniqueOrThrow({
            where: { projectId_userId: { projectId, userId } },
          });
          await tx.projectMember.delete({ where: { id: row.id } });
          await audit(ctx, tx, "ProjectMember", row.id, "DELETE");
        } else {
          const roleId = optional(data, "roleId");
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
          const fields = { roleId, isManager: data.get("isManager") === "on" };
          const row = await tx.projectMember.upsert({
            where: { projectId_userId: { projectId, userId } },
            create: { projectId, userId, ...fields },
            update: fields,
          });
          await audit(ctx, tx, "ProjectMember", row.id, "UPSERT");
        }
      } else {
        const workerId = id.parse(data.get("workerId"));
        await tx.$queryRaw`SELECT id FROM workers WHERE id = ${workerId} FOR UPDATE`;
        const worker = await tx.worker.findFirstOrThrow({
          where: { id: workerId, organizationId: ctx.org.id },
        });
        const assignmentId = optional(data, "id");
        if (assignmentId)
          await tx.projectWorker.findFirstOrThrow({
            where: { id: assignmentId, projectId, workerId },
          });
        if (operation === "REMOVE_WORKER") {
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
            startDate: date.parse(data.get("startDate")),
            endDate: nullableDate(data, "endDate"),
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
            data.get("confirmOverlap") === "on",
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
            dayRateOverride: rate
              .nullable()
              .parse(optional(data, "dayRateOverride")),
            otHourlyRateOverride: rate
              .nullable()
              .parse(optional(data, "otHourlyRateOverride")),
            notes: text.parse(value(data, "notes")),
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
            { overlapConfirmed: data.get("confirmOverlap") === "on" },
          );
        }
      }
    });
    return undefined;
  });
}
