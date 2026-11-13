import "server-only";
import { db } from "@/core/db";
import type { ApprovalReminderOutbox, Prisma } from "@/generated/prisma/client";
import { reminderDelayMs } from "../workflows/reminder-logic";

export async function enqueueApprovalReminder(
  tx: Prisma.TransactionClient,
  stepId: string,
) {
  return tx.approvalReminderOutbox.create({
    data: {
      stepId,
      delayMs: reminderDelayMs(process.env.APPROVAL_REMINDER_HOURS),
    },
  });
}

export type ReminderLaunch = (input: {
  requestId: string;
  stepId: string;
  delayMs: number;
  submittedAt: string;
}) => Promise<{ runId: string }>;

async function claimReminder(stepId?: string) {
  const token = crypto.randomUUID();
  const rows = await db.$queryRaw<ApprovalReminderOutbox[]>`
    WITH due AS (
      SELECT id FROM approval_reminder_outbox
      WHERE status = 'PENDING' AND "availableAt" <= CURRENT_TIMESTAMP
        AND ("leaseUntil" IS NULL OR "leaseUntil" <= CURRENT_TIMESTAMP)
        AND (${stepId ?? null}::text IS NULL OR "stepId" = ${stepId ?? null})
      ORDER BY "availableAt", id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE approval_reminder_outbox AS job SET "leaseToken" = ${token},
      "leaseUntil" = CURRENT_TIMESTAMP + INTERVAL '2 minutes',
      attempts = attempts + 1, "updatedAt" = CURRENT_TIMESTAMP
    FROM due WHERE job.id = due.id RETURNING job.*
  `;
  return rows[0];
}

async function launchWithTimeout(
  launch: ReminderLaunch,
  input: Parameters<ReminderLaunch>[0],
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      launch(input),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("ReminderLaunchTimeout")),
          30000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Bounded, at-least-once dispatch. Lease tokens fence acknowledgements from old workers. */
export async function dispatchReminderOutbox(
  launch: ReminderLaunch,
  stepId?: string,
) {
  let processed = 0;
  for (; processed < 10; processed++) {
    const job = await claimReminder(stepId);
    if (!job) break;
    const owned = { id: job.id, leaseToken: job.leaseToken, status: "PENDING" };
    try {
      const step = await db.approvalRequestStep.findUnique({
        where: { id: job.stepId },
        include: {
          request: {
            include: {
              organization: {
                select: { tenant: { select: { status: true } } },
              },
            },
          },
        },
      });
      if (
        !step ||
        step.status !== "PENDING" ||
        step.request.status !== "PENDING" ||
        step.request.organization.tenant.status !== "ACTIVE"
      ) {
        await db.approvalReminderOutbox.updateMany({
          where: owned,
          data: {
            status: "SKIPPED",
            completedAt: new Date(),
            leaseToken: null,
            leaseUntil: null,
          },
        });
        continue;
      }
      const run = await launchWithTimeout(launch, {
        requestId: step.requestId,
        stepId: step.id,
        delayMs: job.delayMs,
        submittedAt: job.createdAt.toISOString(),
      });
      await db.approvalReminderOutbox.updateMany({
        where: owned,
        data: {
          status: "DELIVERED",
          runId: run.runId,
          completedAt: new Date(),
          lastError: null,
          leaseToken: null,
          leaseUntil: null,
        },
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      await db.approvalReminderOutbox.updateMany({
        where: owned,
        data: {
          availableAt: new Date(
            Date.now() +
              Math.min(3_600_000, 30_000 * 2 ** Math.min(job.attempts - 1, 7)),
          ),
          leaseToken: null,
          leaseUntil: null,
          lastError: errorName,
        },
      });
      console.error("Approval reminder launch will retry", {
        outboxId: job.id,
        attempt: job.attempts,
        errorName,
      });
    }
  }
  return processed;
}
