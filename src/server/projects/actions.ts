"use server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  AttendanceStatus,
  CostType,
  PayType,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@/generated/prisma/enums";
import { type ActionState, runAction } from "../action-result";
import { submitForApproval } from "../approvals/service";
import { writeAudit } from "../audit";
import {
  assertPermission,
  type OrgContext,
  requireOrgContext,
  requireProjectContext,
} from "../context";
import { db } from "../db";
import { lockStockProjects } from "../inventory/service";
import { nextDocumentNumber } from "../numbering";
import { validateProjectCostRecognitionChange } from "../procurement/cost-recognition";
import { storage } from "../storage";
import { checkAvailability } from "./availability";
import { attendanceCost } from "./costing";

const id = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(150);
const text = z.string().trim().max(5000);
const money = z
  .string()
  .regex(
    /^\d{1,16}(?:\.\d{1,2})?$/,
    "Enter a nonnegative amount with up to two decimal places.",
  );
const rate = z
  .string()
  .regex(
    /^\d{1,14}(?:\.\d{1,4})?$/,
    "Enter a nonnegative rate with up to four decimal places.",
  );
const positiveRate = rate.refine(
  (v) => new Prisma.Decimal(v).gt(0),
  "Days and hours must be positive.",
);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date.",
  )
  .transform((v) => new Date(`${v}T00:00:00Z`));
const value = (data: FormData, key: string) => String(data.get(key) ?? "");
const optional = (data: FormData, key: string) =>
  value(data, key).trim() || null;
const nullableDate = (data: FormData, key: string) =>
  optional(data, key) ? date.parse(value(data, key)) : null;
function dateOrder(start: Date | null, end: Date | null) {
  if (start && end && end < start)
    throw new Error("End date must be on or after start date.");
}
async function audit(
  ctx: OrgContext,
  tx: Prisma.TransactionClient,
  entityType: string,
  entityId: string,
  action: string,
  changes?: Prisma.InputJsonValue,
) {
  await writeAudit(
    {
      tenantId: ctx.tenant.id,
      organizationId: ctx.org.id,
      userId: ctx.user.id,
      entityType,
      entityId,
      action,
      changes,
    },
    tx,
  );
}
async function member(
  ctx: OrgContext,
  tx: Prisma.TransactionClient,
  userId: string | null,
) {
  if (
    userId &&
    !(await tx.member.findFirst({
      where: { organizationId: ctx.org.id, userId },
    }))
  )
    throw new Error("Select a member of this organization.");
}
async function stageInProject(
  tx: Prisma.TransactionClient,
  projectId: string,
  stageId: string | null,
) {
  if (
    stageId &&
    !(await tx.stage.findFirst({ where: { id: stageId, projectId } }))
  )
    throw new Error("Stage does not belong to this project.");
}
export async function saveProjectAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const projectId = optional(data, "id");
    const ctx = projectId
      ? await requireProjectContext(org, projectId)
      : await requireOrgContext(org);
    if (projectId && ctx.permissions.has("project.manage"))
      assertPermission(ctx, "project.manage");
    else assertPermission(ctx, projectId ? "project.edit" : "project.create");
    const input = z
      .object({
        name,
        description: text,
        status: z.enum(ProjectStatus),
        budgetAmount: money,
        currency: z.string().regex(/^[A-Z]{3}$/),
        clientPartyId: id.nullable(),
        managerUserId: id.nullable(),
      })
      .parse({
        ...Object.fromEntries(data),
        clientPartyId: optional(data, "clientPartyId"),
        managerUserId: optional(data, "managerUserId"),
      });
    const startDate = nullableDate(data, "startDate"),
      endDate = nullableDate(data, "endDate");
    dateOrder(startDate, endDate);
    const saved = await db.$transaction(async (tx) => {
      await member(ctx, tx, input.managerUserId);
      let clientPartyId = input.clientPartyId;
      if (
        clientPartyId &&
        !(await tx.party.findFirst({
          where: {
            id: clientPartyId,
            tenantId: ctx.tenant.id,
            isCustomer: true,
          },
        }))
      )
        throw new Error("Select a customer from this tenant.");
      if (optional(data, "customerName")) {
        const displayName = name.parse(value(data, "customerName"));
        const customer = await tx.party.create({
          data: {
            tenantId: ctx.tenant.id,
            code: `${ctx.org.slug}-${await nextDocumentNumber(ctx.org.id, "CUS", tx)}`,
            displayName,
            legalName: name.parse(
              optional(data, "customerLegalName") ?? displayName,
            ),
            isCustomer: true,
          },
        });
        clientPartyId = customer.id;
        await audit(ctx, tx, "Party", customer.id, "CREATE");
      }
      const materialCostRecognition = z
        .enum(["ON_RECEIPT", "ON_CONSUMPTION"])
        .optional()
        .parse(optional(data, "materialCostRecognition") ?? undefined);
      let oldMode: "ON_RECEIPT" | "ON_CONSUMPTION" | undefined;
      if (projectId && materialCostRecognition) {
        if (
          !ctx.isAdmin &&
          !ctx.permissions.has("project.edit") &&
          !ctx.permissions.has("project.manage")
        )
          assertPermission(ctx, "project.settings.manage");
        await lockStockProjects(tx, ctx.org.id, [projectId]);
        oldMode = await validateProjectCostRecognitionChange(
          tx,
          ctx.org.id,
          projectId,
          materialCostRecognition,
          data.get("confirmCostRecognitionChange") === "on",
        );
      }
      const fields = {
        ...input,
        clientPartyId,
        startDate,
        endDate,
        ...(materialCostRecognition ? { materialCostRecognition } : {}),
      };
      const row = projectId
        ? await tx.project.update({ where: { id: projectId }, data: fields })
        : await tx.project.create({
            data: {
              ...fields,
              organizationId: ctx.org.id,
              code: await nextDocumentNumber(ctx.org.id, "PRJ", tx),
            },
          });
      await audit(ctx, tx, "Project", row.id, projectId ? "UPDATE" : "CREATE");
      if (oldMode && oldMode !== row.materialCostRecognition)
        await audit(
          ctx,
          tx,
          "Project",
          row.id,
          "MATERIAL_COST_RECOGNITION_CHANGED",
          {
            oldValue: oldMode,
            newValue: row.materialCostRecognition,
            futureTransactionsOnly: true,
          },
        );
      return row;
    });
    return projectId ? undefined : `/${org}/projects/${saved.id}`;
  });
}
export async function saveProjectCostRecognitionAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    if (
      !ctx.isAdmin &&
      !ctx.permissions.has("project.edit") &&
      !ctx.permissions.has("project.manage")
    )
      assertPermission(ctx, "project.settings.manage");
    const newMode = z
      .enum(["ON_RECEIPT", "ON_CONSUMPTION"])
      .parse(data.get("materialCostRecognition"));
    await db.$transaction(async (tx) => {
      await lockStockProjects(tx, ctx.org.id, [projectId]);
      const oldMode = await validateProjectCostRecognitionChange(
        tx,
        ctx.org.id,
        projectId,
        newMode,
        data.get("confirmCostRecognitionChange") === "on",
      );
      if (oldMode === newMode) return;
      await tx.project.update({
        where: { id: projectId },
        data: { materialCostRecognition: newMode },
      });
      await audit(
        ctx,
        tx,
        "Project",
        projectId,
        "MATERIAL_COST_RECOGNITION_CHANGED",
        { oldValue: oldMode, newValue: newMode, futureTransactionsOnly: true },
      );
    });
    return undefined;
  });
}
export async function saveStageAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "stage.manage");
    const stageId = optional(data, "id");
    const input = z
      .object({
        name,
        sequence: z.coerce.number().int().min(1).max(100000),
        status: z.enum(ProjectStatus),
        managerUserId: id.nullable(),
        budgetAmount: money.nullable(),
      })
      .parse({
        ...Object.fromEntries(data),
        managerUserId: optional(data, "managerUserId"),
        budgetAmount: optional(data, "budgetAmount"),
      });
    const startDate = nullableDate(data, "startDate"),
      endDate = nullableDate(data, "endDate");
    dateOrder(startDate, endDate);
    await db.$transaction(async (tx) => {
      await stageInProject(tx, projectId, stageId);
      await member(ctx, tx, input.managerUserId);
      const row = stageId
        ? await tx.stage.update({
            where: { id: stageId },
            data: { ...input, startDate, endDate },
          })
        : await tx.stage.create({
            data: { ...input, startDate, endDate, projectId },
          });
      await audit(ctx, tx, "Stage", row.id, stageId ? "UPDATE" : "CREATE");
    });
    return undefined;
  });
}
export async function saveTaskAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "task.manage");
    const taskId = optional(data, "id");
    const input = z
      .object({
        title: name,
        description: text,
        stageId: id.nullable(),
        priority: z.enum(TaskPriority),
        estimatedHours: rate.nullable(),
        progressPercent: z.coerce.number().int().min(0).max(100),
        status: z.enum([
          TaskStatus.TODO,
          TaskStatus.IN_PROGRESS,
          TaskStatus.REWORK,
          TaskStatus.CANCELLED,
        ]),
      })
      .parse({
        ...Object.fromEntries(data),
        stageId: optional(data, "stageId"),
        estimatedHours: optional(data, "estimatedHours"),
      });
    const plannedStart = nullableDate(data, "plannedStart"),
      dueDate = nullableDate(data, "dueDate");
    dateOrder(plannedStart, dueDate);
    const saved = await db.$transaction(async (tx) => {
      await stageInProject(tx, projectId, input.stageId);
      if (taskId) {
        await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`;
        const task = await tx.task.findFirstOrThrow({
          where: { id: taskId, projectId },
        });
        if (["SUBMITTED", "COMPLETED"].includes(task.status))
          throw new Error("Submitted/completed tasks cannot be edited.");
        if (
          task.dueDate?.getTime() !== dueDate?.getTime() &&
          (await tx.taskDelayRequest.count({
            where: { taskId, status: "PENDING" },
          }))
        )
          throw new Error(
            "Decide the pending delay before changing the due date.",
          );
      }
      const current = taskId
        ? await tx.task.findUniqueOrThrow({ where: { id: taskId } })
        : null;
      const fields = {
        ...input,
        plannedStart,
        dueDate,
        actualStart:
          input.status === "IN_PROGRESS"
            ? (current?.actualStart ?? new Date())
            : current?.actualStart,
      };
      const row = taskId
        ? await tx.task.update({ where: { id: taskId }, data: fields })
        : await tx.task.create({
            data: {
              ...fields,
              projectId,
              code: await nextDocumentNumber(ctx.org.id, "TSK", tx),
            },
          });
      await audit(ctx, tx, "Task", row.id, taskId ? "UPDATE" : "CREATE");
      return row;
    });
    return taskId
      ? undefined
      : `/${org}/projects/${projectId}/tasks/${saved.id}`;
  });
}
export async function taskWorkAction(
  org: string,
  projectId: string,
  taskId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    const operation = z
      .enum(["START", "ASSIGN", "UNASSIGN", "SUBMIT", "DELAY"])
      .parse(data.get("operation"));
    assertPermission(
      ctx,
      operation === "SUBMIT"
        ? "task.submit"
        : operation === "DELAY"
          ? "task.delay.request"
          : "task.manage",
    );
    const files = data
      .getAll("attachments")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (
      files.length > 10 ||
      files.some(
        (f) =>
          f.size > 20 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    )
      throw new Error(
        "Upload up to ten JPEG, PNG or WebP photos, at most 20 MB each.",
      );
    const uploaded: string[] = [];
    try {
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`;
          const task = await tx.task.findFirstOrThrow({
            where: { id: taskId, projectId },
          });
          if (["COMPLETED", "CANCELLED"].includes(task.status))
            throw new Error("This task is closed.");
          if (operation === "START") {
            if (!["TODO", "REWORK"].includes(task.status))
              throw new Error("Task is already started or submitted.");
            await tx.task.update({
              where: { id: task.id },
              data: {
                status: "IN_PROGRESS",
                actualStart: task.actualStart ?? new Date(),
              },
            });
          } else if (operation === "ASSIGN" || operation === "UNASSIGN") {
            const workerId = id.parse(data.get("workerId"));
            if (operation === "ASSIGN") {
              if (
                !(await tx.projectWorker.findFirst({
                  where: { projectId, workerId, worker: { active: true } },
                }))
              )
                throw new Error("Assign an active worker from this project.");
              const startDate = nullableDate(data, "startDate"),
                endDate = nullableDate(data, "endDate");
              dateOrder(startDate, endDate);
              const row = await tx.taskAssignment.upsert({
                where: { taskId_workerId: { taskId, workerId } },
                create: {
                  taskId,
                  workerId,
                  assignedById: ctx.user.id,
                  startDate,
                  endDate,
                },
                update: { startDate, endDate },
              });
              await audit(ctx, tx, "TaskAssignment", row.id, "UPSERT");
            } else {
              const row = await tx.taskAssignment.findUniqueOrThrow({
                where: { taskId_workerId: { taskId, workerId } },
              });
              await tx.taskAssignment.delete({ where: { id: row.id } });
              await audit(ctx, tx, "TaskAssignment", row.id, "DELETE");
            }
          } else if (operation === "SUBMIT") {
            if (!["IN_PROGRESS", "REWORK"].includes(task.status))
              throw new Error("Start the task before submitting work.");
            const input = z
              .object({
                note: text.min(1),
                progressPercent: z.coerce.number().int().min(0).max(100),
                onBehalfOfWorkerId: id.nullable(),
              })
              .parse({
                ...Object.fromEntries(data),
                onBehalfOfWorkerId: optional(data, "onBehalfOfWorkerId"),
              });
            if (
              input.onBehalfOfWorkerId &&
              !(await tx.taskAssignment.findFirst({
                where: {
                  taskId,
                  workerId: input.onBehalfOfWorkerId,
                  worker: { active: true },
                },
              }))
            )
              throw new Error(
                "Worker must be active and assigned to this task.",
              );
            const row = await tx.taskSubmission.create({
              data: { ...input, taskId, submittedById: ctx.user.id },
            });
            for (const file of files) {
              const storageKey = await storage.put(
                new Uint8Array(await file.arrayBuffer()),
              );
              uploaded.push(storageKey);
              const attachment = await tx.attachment.create({
                data: {
                  organizationId: ctx.org.id,
                  uploadedById: ctx.user.id,
                  entityType: "TaskSubmission",
                  entityId: row.id,
                  filename: file.name,
                  mimeType: file.type,
                  sizeBytes: file.size,
                  storageKey,
                },
              });
              await audit(ctx, tx, "Attachment", attachment.id, "CREATE");
            }
            const request = await submitForApproval(
              {
                orgSlug: org,
                documentType: "TASK_SUBMISSION",
                documentId: row.id,
                title: `${task.code}: ${task.title} — work submission`,
                projectId,
                stageId: task.stageId,
              },
              tx,
              ctx,
            );
            await tx.taskSubmission.update({
              where: { id: row.id },
              data: { approvalRequestId: request.id },
            });
            await tx.task.update({
              where: { id: taskId },
              data: {
                status: "SUBMITTED",
                progressPercent: input.progressPercent,
              },
            });
            await audit(ctx, tx, "TaskSubmission", row.id, "CREATE");
          } else {
            const reason = text.min(1).parse(data.get("reason"));
            const proposedDueDate = date.parse(data.get("proposedDueDate"));
            if (task.dueDate && proposedDueDate <= task.dueDate)
              throw new Error(
                "Proposed date must be later than the current due date.",
              );
            if (
              await tx.taskDelayRequest.count({
                where: { taskId, status: "PENDING" },
              })
            )
              throw new Error("A delay request is already pending.");
            const row = await tx.taskDelayRequest.create({
              data: {
                taskId,
                requestedById: ctx.user.id,
                currentDueDate: task.dueDate,
                proposedDueDate,
                reason,
              },
            });
            const request = await submitForApproval(
              {
                orgSlug: org,
                documentType: "TASK_DELAY",
                documentId: row.id,
                title: `${task.code}: ${task.title} — delay to ${proposedDueDate.toISOString().slice(0, 10)}`,
                projectId,
                stageId: task.stageId,
              },
              tx,
              ctx,
            );
            await tx.taskDelayRequest.update({
              where: { id: row.id },
              data: { approvalRequestId: request.id },
            });
            await audit(ctx, tx, "TaskDelayRequest", row.id, "CREATE");
          }
          await audit(ctx, tx, "Task", taskId, operation);
        },
        { timeout: 30000 },
      );
    } catch (error) {
      await Promise.allSettled(uploaded.map((key) => storage.delete(key)));
      throw error;
    }
    return undefined;
  });
}
export async function saveWorkerAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "workforce.manage");
    const workerId = optional(data, "id");
    const input = z
      .object({
        name,
        phone: z.string().max(40).nullable(),
        designationId: id.nullable(),
        payType: z.enum(PayType),
        salaryAmount: money,
        costDaysPerMonth: positiveRate,
        standardHoursPerDay: positiveRate,
        overtimeMultiplier: rate,
      })
      .parse({
        ...Object.fromEntries(data),
        phone: optional(data, "phone"),
        designationId: optional(data, "designationId"),
      });
    await db.$transaction(async (tx) => {
      if (workerId)
        await tx.worker.findFirstOrThrow({
          where: { id: workerId, organizationId: ctx.org.id },
        });
      if (input.designationId)
        await tx.designation.findFirstOrThrow({
          where: { id: input.designationId, tenantId: ctx.tenant.id },
        });
      const fields = {
        ...input,
        joinDate: nullableDate(data, "joinDate"),
        active: data.get("active") === "on",
      };
      const row = workerId
        ? await tx.worker.update({ where: { id: workerId }, data: fields })
        : await tx.worker.create({
            data: {
              ...fields,
              organizationId: ctx.org.id,
              code: await nextDocumentNumber(ctx.org.id, "WRK", tx),
            },
          });
      await audit(ctx, tx, "Worker", row.id, workerId ? "UPDATE" : "CREATE");
    });
    return undefined;
  });
}
export async function designationAction(
  org: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireOrgContext(org);
    assertPermission(ctx, "workforce.manage");
    const designationId = optional(data, "id");
    await db.$transaction(async (tx) => {
      if (designationId)
        await tx.designation.findFirstOrThrow({
          where: { id: designationId, tenantId: ctx.tenant.id },
        });
      if (data.get("operation") === "DELETE" && designationId) {
        await tx.designation.delete({ where: { id: designationId } });
        await audit(ctx, tx, "Designation", designationId, "DELETE");
      } else {
        const fields = { name: name.parse(data.get("name")) };
        const row = designationId
          ? await tx.designation.update({
              where: { id: designationId },
              data: fields,
            })
          : await tx.designation.create({
              data: { ...fields, tenantId: ctx.tenant.id },
            });
        await audit(
          ctx,
          tx,
          "Designation",
          row.id,
          designationId ? "UPDATE" : "CREATE",
        );
      }
    });
    return undefined;
  });
}
export async function teamAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "project.edit");
    const operation = z
      .enum(["MEMBER", "WORKER", "REMOVE_MEMBER", "REMOVE_WORKER"])
      .parse(data.get("operation"));
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
export async function attendanceAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "attendance.record");
    const day = date.parse(data.get("date"));
    const rows = z
      .array(
        z.object({
          workerId: id,
          status: z.enum(AttendanceStatus),
          hoursWorked: rate,
          overtimeHours: rate,
          remove: z.boolean().optional(),
        }),
      )
      .max(1000)
      .parse(JSON.parse(value(data, "rows")));
    if (new Set(rows.map((r) => r.workerId)).size !== rows.length)
      throw new Error("Duplicate worker rows.");
    await db.$transaction(
      async (tx) => {
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
            amount: totalCost,
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
  });
}
export async function expenseAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "expense.create");
    const input = z
      .object({
        stageId: id.nullable(),
        taskId: id.nullable(),
        partyId: id.nullable(),
        costType: z.enum(CostType),
        amount: money.refine((v) => new Prisma.Decimal(v).gt(0)),
        description: text.min(1),
      })
      .parse({
        ...Object.fromEntries(data),
        stageId: optional(data, "stageId"),
        taskId: optional(data, "taskId"),
        partyId: optional(data, "partyId"),
      });
    await db.$transaction(async (tx) => {
      await stageInProject(tx, projectId, input.stageId);
      if (input.taskId) {
        const task = await tx.task.findFirstOrThrow({
          where: { id: input.taskId, projectId },
        });
        if (input.stageId && input.stageId !== task.stageId)
          throw new Error("Task does not belong to selected stage.");
        input.stageId = task.stageId;
      }
      if (input.partyId)
        await tx.party.findFirstOrThrow({
          where: { id: input.partyId, tenantId: ctx.tenant.id },
        });
      const row = await tx.expense.create({
        data: {
          ...input,
          projectId,
          date: date.parse(data.get("date")),
          createdById: ctx.user.id,
          code: await nextDocumentNumber(ctx.org.id, "EXP", tx),
        },
      });
      const request = await submitForApproval(
        {
          orgSlug: org,
          documentType: "EXPENSE",
          documentId: row.id,
          title: `${row.code}: ${row.description}`,
          amount: row.amount.toString(),
          projectId,
          stageId: row.stageId,
        },
        tx,
        ctx,
      );
      await tx.expense.update({
        where: { id: row.id },
        data: { approvalRequestId: request.id },
      });
      await audit(ctx, tx, "Expense", row.id, "CREATE");
    });
    return undefined;
  });
}
export async function budgetAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "project.edit");
    await db.$transaction(async (tx) => {
      if (data.get("operation") === "TOTAL") {
        await tx.project.update({
          where: { id: projectId },
          data: { budgetAmount: money.parse(data.get("budgetAmount")) },
        });
        await audit(ctx, tx, "Project", projectId, "BUDGET");
        return;
      }
      const lineId = optional(data, "id");
      if (lineId)
        await tx.projectBudgetLine.findFirstOrThrow({
          where: { id: lineId, projectId },
        });
      if (data.get("operation") === "DELETE" && lineId) {
        await tx.projectBudgetLine.delete({ where: { id: lineId } });
        await audit(ctx, tx, "ProjectBudgetLine", lineId, "DELETE");
      } else {
        const input = z
          .object({
            costType: z.enum(CostType),
            stageId: id.nullable(),
            amount: money,
            note: text,
          })
          .parse({
            ...Object.fromEntries(data),
            stageId: optional(data, "stageId"),
          });
        await stageInProject(tx, projectId, input.stageId);
        const row = lineId
          ? await tx.projectBudgetLine.update({
              where: { id: lineId },
              data: input,
            })
          : await tx.projectBudgetLine.create({
              data: { ...input, projectId },
            });
        await audit(
          ctx,
          tx,
          "ProjectBudgetLine",
          row.id,
          lineId ? "UPDATE" : "CREATE",
        );
      }
    });
    return undefined;
  });
}
export async function siteAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "project.edit");
    await db.$transaction(async (tx) => {
      const siteId = optional(data, "id");
      if (siteId)
        await tx.projectSite.findFirstOrThrow({
          where: { id: siteId, projectId },
        });
      if (data.get("operation") === "DELETE" && siteId) {
        await tx.projectSite.delete({ where: { id: siteId } });
        await audit(ctx, tx, "ProjectSite", siteId, "DELETE");
      } else {
        const coordinate = (key: string, limit: number) =>
          z
            .string()
            .regex(/^-?\d+(?:\.\d{1,7})?$/)
            .refine((v) => new Prisma.Decimal(v).abs().lte(limit))
            .nullable()
            .parse(optional(data, key));
        const input = z
          .object({
            name,
            address: text.min(1),
            pincode: z.string().max(30).nullable(),
            countryId: id.nullable(),
            stateId: id.nullable(),
            cityId: id.nullable(),
          })
          .parse({
            ...Object.fromEntries(data),
            pincode: optional(data, "pincode"),
            countryId: optional(data, "countryId"),
            stateId: optional(data, "stateId"),
            cityId: optional(data, "cityId"),
          });
        if (input.countryId)
          await tx.country.findUniqueOrThrow({
            where: { id: input.countryId },
          });
        if (input.stateId)
          await tx.state.findFirstOrThrow({
            where: { id: input.stateId, countryId: input.countryId ?? "" },
          });
        if (input.cityId)
          await tx.city.findFirstOrThrow({
            where: {
              id: input.cityId,
              stateId: input.stateId ?? "",
              tenantId: ctx.tenant.id,
            },
          });
        const fields = {
          ...input,
          latitude: coordinate("latitude", 90),
          longitude: coordinate("longitude", 180),
        };
        const row = siteId
          ? await tx.projectSite.update({ where: { id: siteId }, data: fields })
          : await tx.projectSite.create({ data: { ...fields, projectId } });
        await audit(
          ctx,
          tx,
          "ProjectSite",
          row.id,
          siteId ? "UPDATE" : "CREATE",
        );
      }
    });
    return undefined;
  });
}
export async function deleteStageAction(
  org: string,
  projectId: string,
  _: ActionState,
  data: FormData,
) {
  return runAction(async () => {
    const ctx = await requireProjectContext(org, projectId);
    assertPermission(ctx, "stage.manage");
    const stageId = id.parse(data.get("id"));
    await db.$transaction(async (tx) => {
      await stageInProject(tx, projectId, stageId);
      const references = await tx.stage.findUniqueOrThrow({
        where: { id: stageId },
        select: {
          _count: {
            select: {
              tasks: true,
              budgetLines: true,
              expenses: true,
              costs: true,
              policies: true,
              requests: true,
            },
          },
        },
      });
      if (Object.values(references._count).some((count) => count > 0))
        throw new Error("Referenced stages cannot be deleted.");
      await tx.stage.delete({ where: { id: stageId } });
      await audit(ctx, tx, "Stage", stageId, "DELETE");
    });
    return undefined;
  });
}
