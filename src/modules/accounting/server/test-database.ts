import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import type { Prisma } from "@/generated/prisma/client";

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

export async function withAccountingTestDatabase(
  work: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  assert.equal(
    process.env.ACCOUNTING_DB_TEST,
    "local-only",
    "Accounting DB tests are opt-in",
  );
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "ACCOUNTING_DB_TEST requires a loopback DATABASE_URL",
  );
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      const resolved = nextResolve(specifier, context);
      return specifier === "server-only"
        ? { ...resolved, url: resolved.url.replace("index.js", "empty.js") }
        : resolved;
    },
  });
  try {
    const { db } = await import("@/core/db");
    const rollback = new Error("ROLLBACK_ACCOUNTING_TEST");
    try {
      await db
        .$transaction(
          async (tx) => {
            await work(tx);
            throw rollback;
          },
          { maxWait: 15_000, timeout: 60_000 },
        )
        .then(
          () => {
            throw new Error("Accounting test transaction did not roll back");
          },
          (error: unknown) => {
            if (error !== rollback) throw error;
          },
        );
    } finally {
      await db.$disconnect();
    }
  } finally {
    hooks.deregister();
  }
}

export async function expectAccountingFailure(
  tx: Prisma.TransactionClient,
  work: () => Promise<unknown>,
  pattern?: RegExp,
) {
  await tx.$executeRawUnsafe("SAVEPOINT accounting_expected_failure");
  try {
    await assert.rejects(work, (error: unknown) => {
      if (pattern) assert.match(String(error), pattern);
      return true;
    });
  } finally {
    await tx.$executeRawUnsafe(
      "ROLLBACK TO SAVEPOINT accounting_expected_failure",
    );
    await tx.$executeRawUnsafe("RELEASE SAVEPOINT accounting_expected_failure");
  }
}
