import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("eager approval registration works after concrete feature entry points", () => {
  for (const entry of [
    "procurement/server/submission",
    "payment/server/submission",
    "project-task/server/work-service",
    "approvals/server/service",
    "approvals/server/register",
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      import { registerHooks } from 'node:module';
      registerHooks({ resolve(specifier, context, next) {
        const result = next(specifier, context);
        return specifier === 'server-only'
          ? { ...result, url: result.url.replace('index.js', 'empty.js') } : result;
      }});
      await import('@/modules/${entry}');
      ${entry.startsWith("approvals/") ? "" : "await import('@/modules/approvals/server/register');"}
      const { getApprovalHandler } = await import('@/modules/approvals/server/handlers');
      for (const type of ['TASK_SUBMISSION', 'TASK_DELAY', 'EXPENSE', 'PURCHASE_REQUEST',
        'PURCHASE_ORDER', 'GRN', 'STOCK_TRANSFER', 'VENDOR_BILL', 'PAYMENT_REQUEST', 'SALES_INVOICE', 'JOURNAL']) {
        const handler = getApprovalHandler(type);
        if (!handler || typeof handler.onApproved !== 'function' ||
          typeof handler.onRejected !== 'function' || typeof handler.onCanceled !== 'function')
          throw new Error('Missing eager handler: ' + type);
      }
    `,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL:
            "postgresql://placeholder:placeholder@localhost:5432/placeholder",
          BETTER_AUTH_URL: "http://localhost:3000",
        },
      },
    );
    assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
  }
});
