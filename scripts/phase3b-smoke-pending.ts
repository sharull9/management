import type { PrismaClient } from "@/generated/prisma/client";
import type { createFixture } from "./phase3b-smoke-fixture";
export async function pendingSmoke(
  db: PrismaClient,
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  const { token, user, org, p1 } = fixture;
  const { submitForApproval } = await import(
    "@/modules/approvals/server/service"
  );
  // Finance/procurement types already exist in history. Add the remaining types.
  for (const type of ["TASK_SUBMISSION", "TASK_DELAY", "EXPENSE"] as const) {
    const stage = await db.stage.upsert({
      where: { id: `${token}-stage` },
      create: {
        id: `${token}-stage`,
        projectId: p1.id,
        name: "Smoke stage",
        sequence: 1,
      },
      update: {},
    });
    const task = await db.task.upsert({
      where: { id: `${token}-task` },
      create: {
        id: `${token}-task`,
        projectId: p1.id,
        stageId: stage.id,
        code: "TASK",
        title: "Smoke task",
      },
      update: {},
    });
    let id: string;
    if (type === "TASK_SUBMISSION")
      id = (
        await db.taskSubmission.create({
          data: {
            taskId: task.id,
            submittedById: user.id,
            note: "Ready",
            progressPercent: 100,
          },
        })
      ).id;
    else if (type === "TASK_DELAY")
      id = (
        await db.taskDelayRequest.create({
          data: {
            taskId: task.id,
            requestedById: user.id,
            proposedDueDate: new Date("2026-10-20"),
            reason: "Rain",
          },
        })
      ).id;
    else
      id = (
        await db.expense.create({
          data: {
            projectId: p1.id,
            code: "EXP-SMOKE",
            date: new Date("2026-09-10"),
            costType: "OTHER",
            amount: "10",
            description: "Pending smoke expense",
            createdById: user.id,
          },
        })
      ).id;
    const r = await submitForApproval({
      orgSlug: org.slug,
      documentType: type,
      documentId: id,
      projectId: p1.id,
      stageId: stage.id,
      title: `Smoke ${type}`,
    });
    const update = { approvalRequestId: r.id };
    if (type === "TASK_SUBMISSION")
      await db.taskSubmission.update({ where: { id }, data: update });
    else if (type === "TASK_DELAY")
      await db.taskDelayRequest.update({ where: { id }, data: update });
    else await db.expense.update({ where: { id }, data: update });
  }
}
