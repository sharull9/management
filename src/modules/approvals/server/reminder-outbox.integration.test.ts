import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as nodeModule from "node:module";
import test from "node:test";
import type { OrgContext } from "@/core/context";

type Resolve = (specifier: string, context: object) => { url: string };
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: {
    resolve: (
      specifier: string,
      context: object,
      next: Resolve,
    ) => { url: string };
  }) => { deregister: () => void };
};

test(
  "reminder outbox survives rollback, failed launches, worker crashes and competing dispatchers",
  {
    skip: process.env.APPROVALS_DB_TEST !== "local-only",
  },
  async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    assert.match(url.pathname, /_test$/);
    const hooks = registerHooks({
      resolve(specifier, context, next) {
        const result = next(specifier, context);
        return specifier === "server-only"
          ? { ...result, url: result.url.replace("index.js", "empty.js") }
          : result;
      },
    });
    const oldDelay = process.env.APPROVAL_REMINDER_HOURS;
    process.env.APPROVAL_REMINDER_HOURS = "0.5";
    const { db } = await import("@/core/db");
    try {
      const { submitForApproval } = await import("./service");
      const { dispatchReminderOutbox } = await import("./reminder-outbox");
      const { createApprovalReminder } = await import(
        "./reminder-notifications"
      );
      const token = `reminder-outbox-${crypto.randomUUID()}`;
      const tenant = await db.tenant.create({
        data: { name: token, slug: token },
      });
      const org = await db.organization.create({
        data: { name: token, slug: token, tenantId: tenant.id },
      });
      const user = await db.user.create({
        data: { name: token, email: `${token}@example.test` },
      });
      await db.tenantMember.create({
        data: { tenantId: tenant.id, userId: user.id, role: "OWNER" },
      });
      await db.member.create({
        data: { organizationId: org.id, userId: user.id, role: "owner" },
      });
      const ctx = {
        org: { ...org, tenant },
        tenant,
        user,
        member: null,
        tenantRole: "OWNER",
        isAdmin: true,
        permissions: new Set<string>(),
      } as unknown as OrgContext;
      const submit = () =>
        db.$transaction((tx) =>
          submitForApproval(
            {
              orgSlug: org.slug,
              documentType: "PURCHASE_REQUEST",
              documentId: crypto.randomUUID(),
              title: token,
            },
            tx,
            ctx,
          ),
        );
      const jobFor = (stepId: string) =>
        db.approvalReminderOutbox.findUniqueOrThrow({ where: { stepId } });
      const ready = (stepId: string) =>
        db.approvalReminderOutbox.update({
          where: { stepId },
          data: { availableAt: new Date(0) },
        });
      const successfulLaunch = async () => ({ runId: crypto.randomUUID() });

      const rollback = new Error("ROLLBACK_OUTBOX");
      let rolledBackStep = "";
      await assert.rejects(
        db.$transaction(async (tx) => {
          const request = await submitForApproval(
            {
              orgSlug: org.slug,
              documentType: "PURCHASE_REQUEST",
              documentId: crypto.randomUUID(),
              title: token,
            },
            tx,
            ctx,
          );
          rolledBackStep = request.steps[0]?.id ?? "";
          assert.ok(
            await tx.approvalReminderOutbox.findUnique({
              where: { stepId: rolledBackStep },
            }),
          );
          throw rollback;
        }),
        (error) => error === rollback,
      );
      assert.equal(
        await db.approvalReminderOutbox.findUnique({
          where: { stepId: rolledBackStep },
        }),
        null,
      );

      const request = await submit();
      const stepId = request.steps[0]?.id;
      assert.ok(stepId);
      const queued = await jobFor(stepId);
      assert.equal(queued.status, "PENDING");
      assert.equal(queued.delayMs, 1800000);
      process.env.APPROVAL_REMINDER_HOURS = "5";
      let attempts = 0;
      await dispatchReminderOutbox(async (input) => {
        attempts++;
        assert.equal(input.delayMs, 1800000);
        assert.equal(input.submittedAt, queued.createdAt.toISOString());
        // The backend can accept a launch before the caller loses its response.
        await createApprovalReminder(input.requestId, input.stepId, 0);
        throw new TypeError("Simulated backend response loss");
      }, stepId);
      const failed = await jobFor(stepId);
      assert.equal(failed.status, "PENDING");
      assert.equal(failed.attempts, 1);
      assert.equal(failed.leaseUntil, null);
      assert.equal(failed.lastError, "TypeError");
      assert.ok(failed.availableAt.getTime() > Date.now());
      await dispatchReminderOutbox(async () => {
        attempts++;
        return successfulLaunch();
      }, stepId);
      assert.equal(attempts, 1, "backoff prevents immediate retries");
      await ready(stepId);
      await dispatchReminderOutbox(async (input) => {
        await createApprovalReminder(input.requestId, input.stepId, 0);
        return { runId: "accepted-retry" };
      }, stepId);
      assert.equal((await jobFor(stepId)).runId, "accepted-retry");
      assert.equal((await jobFor(stepId)).status, "DELIVERED");
      assert.equal((await jobFor(stepId)).attempts, 2);
      assert.equal(
        await db.notification.count({ where: { organizationId: org.id } }),
        1,
        "duplicate launches do not duplicate notifications",
      );

      const crashed = await submit();
      const crashedStep = crashed.steps[0]?.id;
      assert.ok(crashedStep);
      await db.approvalReminderOutbox.update({
        where: { stepId: crashedStep },
        data: {
          leaseToken: "crashed-worker",
          leaseUntil: new Date(Date.now() + 60000),
          attempts: 1,
        },
      });
      assert.equal(
        await dispatchReminderOutbox(successfulLaunch, crashedStep),
        0,
      );
      await db.approvalReminderOutbox.update({
        where: { stepId: crashedStep },
        data: { leaseUntil: new Date(0) },
      });
      assert.equal(
        await dispatchReminderOutbox(successfulLaunch, crashedStep),
        1,
      );
      assert.equal((await jobFor(crashedStep)).attempts, 2);

      const racing = await submit();
      const racingStep = racing.steps[0]?.id;
      assert.ok(racingStep);
      let started = () => {};
      let release = () => {};
      const startedPromise = new Promise<void>((resolve) => {
        started = resolve;
      });
      const releasedPromise = new Promise<void>((resolve) => {
        release = resolve;
      });
      const firstWorker = dispatchReminderOutbox(async () => {
        started();
        await releasedPromise;
        return { runId: "old-worker" };
      }, racingStep);
      await startedPromise;
      assert.equal(
        await dispatchReminderOutbox(successfulLaunch, racingStep),
        0,
        "live leases exclude competing workers",
      );
      await db.approvalReminderOutbox.update({
        where: { stepId: racingStep },
        data: { leaseUntil: new Date(0) },
      });
      await dispatchReminderOutbox(
        async () => ({ runId: "replacement-worker" }),
        racingStep,
      );
      release();
      await firstWorker;
      assert.equal(
        (await jobFor(racingStep)).runId,
        "replacement-worker",
        "expired worker cannot overwrite the replacement acknowledgement",
      );

      for (const status of ["APPROVED", "REJECTED", "CANCELED"] as const) {
        const terminal = await submit();
        const terminalStep = terminal.steps[0]?.id;
        assert.ok(terminalStep);
        await db.approvalRequest.update({
          where: { id: terminal.id },
          data: { status },
        });
        await dispatchReminderOutbox(async () => {
          throw new Error("Terminal request must not launch");
        }, terminalStep);
        assert.equal((await jobFor(terminalStep)).status, "SKIPPED");
      }
      const advanced = await submit();
      const advancedStep = advanced.steps[0]?.id;
      assert.ok(advancedStep);
      await db.approvalRequestStep.update({
        where: { id: advancedStep },
        data: { status: "APPROVED" },
      });
      await dispatchReminderOutbox(successfulLaunch, advancedStep);
      assert.equal((await jobFor(advancedStep)).status, "SKIPPED");
      const suspended = await submit();
      const suspendedStep = suspended.steps[0]?.id;
      assert.ok(suspendedStep);
      await db.tenant.update({
        where: { id: tenant.id },
        data: { status: "SUSPENDED" },
      });
      await dispatchReminderOutbox(successfulLaunch, suspendedStep);
      assert.equal((await jobFor(suspendedStep)).status, "SKIPPED");
      assert.equal(await createApprovalReminder(request.id, stepId, 1), false);
      await db.tenant.update({
        where: { id: tenant.id },
        data: { status: "ACTIVE" },
      });
      for (const ordinal of [1, 2])
        await Promise.all([
          createApprovalReminder(request.id, stepId, ordinal),
          createApprovalReminder(request.id, stepId, ordinal),
        ]);
      assert.equal(
        await db.notification.count({ where: { organizationId: org.id } }),
        3,
      );
      assert.equal(await createApprovalReminder(request.id, stepId, 3), false);
      await db.approvalRequest.update({
        where: { id: request.id },
        data: { status: "CANCELED" },
      });
      assert.equal(await createApprovalReminder(request.id, stepId, 0), false);

      // Apply the exact migration backfill to historical requests without an outbox.
      const historical = await db.approvalRequest.create({
        data: {
          organizationId: org.id,
          documentType: "PURCHASE_REQUEST",
          documentId: crypto.randomUUID(),
          title: token,
          requestedById: user.id,
          steps: {
            create: [
              {
                sequence: 1,
                name: "Old approval",
                approverType: "USER",
                userId: user.id,
                status: "PENDING",
              },
            ],
          },
        },
        include: { steps: true },
      });
      const historicalStep = historical.steps[0]?.id;
      assert.ok(historicalStep);
      const migration = await readFile(
        new URL(
          "../../../../prisma/migrations/20261031010000_approval_reminder_outbox/migration.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await db.$executeRawUnsafe(
        migration.slice(
          migration.indexOf('INSERT INTO "approval_reminder_outbox"'),
        ),
      );
      assert.equal((await jobFor(historicalStep)).delayMs, 86400000);
      assert.equal(
        (await jobFor(historicalStep)).createdAt.toISOString(),
        historical.createdAt.toISOString(),
      );
      assert.equal(
        (await jobFor(stepId)).delayMs,
        1800000,
        "backfill preserves existing delay snapshots",
      );
      assert.equal(
        await dispatchReminderOutbox(successfulLaunch, historicalStep),
        1,
      );
    } finally {
      await db.$disconnect();
      hooks.deregister();
      if (oldDelay === undefined) delete process.env.APPROVAL_REMINDER_HOURS;
      else process.env.APPROVAL_REMINDER_HOURS = oldDelay;
    }
  },
);
