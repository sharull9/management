import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

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
  "overlapping attendance service updates keep attendance, cost and journal aligned",
  { skip: process.env.CONCURRENCY_DB_TEST !== "local-only" },
  async () => {
    assert.equal(process.env.DATABASE_POOL_MAX, "10");
    const url = new URL(process.env.DATABASE_URL ?? "");
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    assert.match(url.pathname, /_test$/);
    const contextUrl = new URL("./concurrency.test-context.ts", import.meta.url)
      .href;
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context);
        if (specifier === "server-only")
          return {
            ...resolved,
            url: resolved.url.replace("index.js", "empty.js"),
          };
        if (specifier === "@/core/context")
          return { ...resolved, url: contextUrl };
        return resolved;
      },
    });
    const state = globalThis as typeof globalThis & {
      __attendanceConcurrencyContext?: Awaited<
        ReturnType<typeof import("@/core/context").requireProjectContext>
      >;
    };
    let db: typeof import("@/core/db")["db"] | undefined;
    let fixture:
      | {
          tenantId: string;
          organizationId: string;
          projectId: string;
          userId: string;
          workerId: string;
        }
      | undefined;
    try {
      ({ db } = await import("@/core/db"));
      const token = `attendance-concurrency-${crypto.randomUUID()}`;
      const created = await db.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: token, slug: token },
        });
        const org = await tx.organization.create({
          data: { name: token, slug: token, tenantId: tenant.id },
        });
        const user = await tx.user.create({
          data: { name: token, email: `${token}@example.test` },
        });
        const project = await tx.project.create({
          data: {
            organizationId: org.id,
            code: token,
            name: token,
            currency: "INR",
          },
        });
        const worker = await tx.worker.create({
          data: {
            organizationId: org.id,
            code: token,
            name: token,
            payType: "DAILY",
            salaryAmount: 1200,
            standardHoursPerDay: 8,
          },
        });
        await tx.projectWorker.create({
          data: {
            projectId: project.id,
            workerId: worker.id,
            startDate: new Date("2026-01-01T00:00:00Z"),
            dayRateOverride: 1200,
            otHourlyRateOverride: 100,
          },
        });
        const context = {
          org,
          tenant,
          user,
          project,
          member: null,
          tenantRole: "OWNER",
          isAdmin: true,
          isProjectManager: true,
          projectMember: null,
          permissions: new Set(["attendance.record"]),
        } as unknown as Awaited<
          ReturnType<typeof import("@/core/context").requireProjectContext>
        >;
        return { tenant, org, user, project, worker, context };
      });
      fixture = {
        tenantId: created.tenant.id,
        organizationId: created.org.id,
        projectId: created.project.id,
        userId: created.user.id,
        workerId: created.worker.id,
      };
      state.__attendanceConcurrencyContext = created.context;
      const { attendance } = await import("./service");
      const date = "2026-02-05";
      const updates = await Promise.allSettled([
        attendance(created.org.slug, created.project.id, {
          date: new Date(`${date}T00:00:00Z`),
          rows: [
            {
              workerId: created.worker.id,
              status: "PRESENT",
              hoursWorked: "8",
              overtimeHours: "1",
            },
          ],
        }),
        attendance(created.org.slug, created.project.id, {
          date: new Date(`${date}T00:00:00Z`),
          rows: [
            {
              workerId: created.worker.id,
              status: "HALF_DAY",
              hoursWorked: "4",
              overtimeHours: "0",
            },
          ],
        }),
      ]);
      assert.equal(
        updates.filter((result) => result.status === "fulfilled").length,
        2,
        "both overlapping service calls should complete",
      );
      const attendanceRow = await db.attendance.findUniqueOrThrow({
        where: {
          workerId_date_projectId: {
            workerId: created.worker.id,
            date: new Date(`${date}T00:00:00Z`),
            projectId: created.project.id,
          },
        },
      });
      const entries = await db.costEntry.findMany({
        where: {
          organizationId: created.org.id,
          sourceType: "ATTENDANCE",
          sourceId: attendanceRow.id,
        },
      });
      assert.equal(entries.length, 1);
      assert.equal(
        entries[0]?.baseAmount.toString(),
        attendanceRow.totalCost.toString(),
      );
      const source = await db.accountingSource.findUniqueOrThrow({
        where: {
          organizationId_sourceType_sourceId: {
            organizationId: created.org.id,
            sourceType: "COST_ENTRY",
            sourceId: entries[0]?.id ?? "",
          },
        },
      });
      assert.ok(source.currentEntryId);
      const journalHistory = await db.journalEntry.findMany({
        where: { accountingSourceId: source.id, status: "POSTED" },
        include: { reversal: { select: { id: true } } },
      });
      const currentEntries = journalHistory.filter(
        (entry) => entry.reversal === null,
      );
      assert.equal(currentEntries.length, 1, "one unreversed journal remains");
      const current = await db.journalEntry.findUniqueOrThrow({
        where: { id: source.currentEntryId },
        include: { lines: { include: { account: true } } },
      });
      assert.equal(current.id, currentEntries[0]?.id);
      const debit = current?.lines.reduce(
        (sum, line) => sum + Number(line.debit),
        0,
      );
      const credit = current?.lines.reduce(
        (sum, line) => sum + Number(line.credit),
        0,
      );
      assert.equal(debit?.toFixed(2), credit?.toFixed(2));
      const labour = current.lines.filter(
        (line) => line.account.systemKey === "LABOUR_EXPENSE",
      );
      assert.equal(
        labour.reduce((sum, line) => sum + Number(line.debit), 0).toFixed(2),
        attendanceRow.totalCost.toFixed(2),
      );
    } finally {
      if (db && fixture) {
        const hasJournalHistory =
          (await db.journalEntry.count({
            where: { organizationId: fixture.organizationId },
          })) > 0;
        if (!hasJournalHistory) {
          const rows = await db.attendance.findMany({
            where: {
              organizationId: fixture.organizationId,
              projectId: fixture.projectId,
              workerId: fixture.workerId,
            },
            select: { id: true },
          });
          const attendanceIds = rows.map((row) => row.id);
          const costs = await db.costEntry.findMany({
            where: {
              organizationId: fixture.organizationId,
              sourceType: "ATTENDANCE",
              sourceId: { in: attendanceIds },
            },
            select: { id: true },
          });
          await db.auditLog.deleteMany({
            where: { organizationId: fixture.organizationId },
          });
          const sources = await db.accountingSource.findMany({
            where: {
              organizationId: fixture.organizationId,
              sourceType: "COST_ENTRY",
              sourceId: { in: costs.map((row) => row.id) },
            },
            select: { id: true },
          });
          await db.accountingSource.updateMany({
            where: { id: { in: sources.map((row) => row.id) } },
            data: { currentEntryId: null },
          });
          const journalEntries = await db.journalEntry.findMany({
            where: { accountingSourceId: { in: sources.map((row) => row.id) } },
            select: { id: true },
            orderBy: { revision: "desc" },
          });
          for (const entry of journalEntries)
            await db.journalEntry.delete({ where: { id: entry.id } });
          await db.accountingSource.deleteMany({
            where: { id: { in: sources.map((row) => row.id) } },
          });
          await db.costEntry.deleteMany({
            where: { id: { in: costs.map((row) => row.id) } },
          });
          await db.attendance.deleteMany({
            where: { id: { in: attendanceIds } },
          });
          await db.ledgerAccount.deleteMany({
            where: { organizationId: fixture.organizationId },
          });
          await db.projectWorker.deleteMany({
            where: { projectId: fixture.projectId, workerId: fixture.workerId },
          });
          await db.project.delete({ where: { id: fixture.projectId } });
          await db.worker.delete({ where: { id: fixture.workerId } });
          await db.organization.delete({
            where: { id: fixture.organizationId },
          });
          await db.accountTemplate.deleteMany({
            where: { tenantId: fixture.tenantId },
          });
          await db.tenant.delete({ where: { id: fixture.tenantId } });
          await db.user.delete({ where: { id: fixture.userId } });
        }
      }
      await db?.$disconnect();
      delete state.__attendanceConcurrencyContext;
      hooks.deregister();
    }
  },
);
