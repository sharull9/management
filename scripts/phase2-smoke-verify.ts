import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.PHASE2_SMOKE_CONFIRM !== "local-only" ||
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new Error(
      "Run only against the local Phase 2 browser smoke fixture.",
    );
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.toString() }),
  });
  try {
    const project = await db.project.findFirstOrThrow({
      where: { organization: { slug: "phase2-smoke" }, code: "PRJ-0001" },
      include: { clientParty: true, stages: true, members: true },
    });
    assert.equal(project.budgetAmount.toFixed(2), "10000.00");
    assert.equal(project.clientParty?.isCustomer, true);
    assert.ok(project.stages.some((s) => s.name === "Groundwork"));
    assert.ok(project.members.length);
    const task = await db.task.findFirstOrThrow({
      where: { projectId: project.id, code: "TSK-0001" },
      include: {
        assignments: true,
        submissions: { include: { approvalRequest: true } },
        delays: true,
      },
    });
    assert.equal(task.status, "COMPLETED");
    assert.equal(task.progressPercent, 100);
    assert.ok(task.completedAt);
    assert.ok(task.actualStart);
    assert.equal(task.dueDate?.toISOString().slice(0, 10), "2026-10-20");
    assert.equal(task.assignments.length, 1);
    assert.equal(task.submissions[0].status, "APPROVED");
    assert.equal(task.delays[0].status, "APPROVED");
    const attendance = await db.attendance.findFirstOrThrow({
      where: { projectId: project.id },
      include: { worker: true },
    });
    assert.equal(attendance.dayCost.toFixed(2), "1000.00");
    assert.equal(attendance.otCost.toFixed(2), "375.00");
    assert.equal(attendance.totalCost.toFixed(2), "1375.00");
    assert.equal(attendance.worker.payType, "MONTHLY");
    const labour = await db.costEntry.findMany({
      where: { projectId: project.id, sourceType: "ATTENDANCE" },
    });
    assert.equal(labour.length, 1);
    assert.equal(labour[0].sourceId, attendance.id);
    assert.equal(labour[0].amount.toFixed(2), "1375.00");
    const approved = await db.expense.findFirstOrThrow({
      where: { projectId: project.id, code: "EXP-0001" },
      include: { approvalRequest: true },
    });
    assert.equal(approved.status, "APPROVED");
    assert.equal(approved.approvalRequest?.amount?.toFixed(2), "1250.50");
    const rejected = await db.expense.findFirstOrThrow({
      where: { projectId: project.id, code: "EXP-0002" },
      include: {
        approvalRequest: {
          include: { steps: true, policy: { include: { steps: true } } },
        },
      },
    });
    assert.equal(rejected.status, "REJECTED");
    assert.equal(rejected.approvalRequest?.amount?.toFixed(2), "2000.00");
    assert.equal(rejected.approvalRequest?.steps.length, 1);
    assert.equal(
      rejected.approvalRequest?.steps[0].approverType,
      "STAGE_MANAGER",
    );
    assert.equal(rejected.approvalRequest?.policy?.steps.length, 2);
    assert.equal(
      await db.costEntry.count({
        where: {
          projectId: project.id,
          sourceType: "EXPENSE",
          sourceId: rejected.id,
        },
      }),
      0,
    );
    const total = await db.costEntry.aggregate({
      where: { projectId: project.id },
      _sum: { amount: true },
    });
    assert.equal(total._sum.amount?.toFixed(2), "2625.50");
    const photo = await db.attachment.findFirstOrThrow({
      where: { entityType: "TaskSubmission", entityId: task.submissions[0].id },
    });
    assert.equal(photo.mimeType, "image/png");
    assert.equal(
      (await readFile(path.join(process.cwd(), "storage", photo.storageKey)))
        .byteLength,
      photo.sizeBytes,
    );
    assert.ok(
      await db.auditLog.count({
        where: {
          organizationId: project.organizationId,
          entityType: "Attendance",
          action: "DELETE",
        },
      }),
    );
    assert.ok(
      await db.auditLog.count({
        where: {
          organizationId: project.organizationId,
          entityType: "CostEntry",
          action: "DELETE",
        },
      }),
    );
    assert.equal(
      await db.approvalRequest.count({
        where: { projectId: project.id, status: "PENDING" },
      }),
      0,
    );
    const member = await db.member.findFirstOrThrow({
      where: {
        organizationId: project.organizationId,
        user: { email: "member@phase2.example.test" },
      },
    });
    assert.equal(member.role, "member");
    assert.equal(member.roleId, null);
    assert.ok(
      project.members.some((m) => m.userId === member.userId && m.isManager),
    );
    const managerExpense = await db.expense.findFirstOrThrow({
      where: { projectId: project.id, code: "EXP-0003" },
      include: { approvalRequest: { include: { steps: true } } },
    });
    assert.equal(managerExpense.status, "REJECTED");
    assert.equal(
      managerExpense.approvalRequest?.steps[0].actedById,
      member.userId,
    );
    assert.ok(
      await db.projectSite.count({
        where: {
          projectId: project.id,
          name: "Main site",
          country: { code: "IN" },
          state: { name: "Tamil Nadu" },
        },
      }),
    );
    assert.ok(
      await db.projectBudgetLine.count({
        where: { projectId: project.id, costType: "MATERIAL", amount: "2000" },
      }),
    );
    console.log(
      "PASS: project/stage/task/worker, attendance upsert/delete ledger, delay/submission approvals, photo bytes, expense approval/rejection, stage policy threshold snapshots, total 2625.50, audit trail, no pending requests.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
