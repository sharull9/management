import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const database = new URL(process.env.DATABASE_URL ?? "");
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname),
  "Database tests require a loopback DATABASE_URL.",
);
assert.match(
  database.pathname,
  /_test$/,
  "Use a disposable database whose name ends in _test.",
);

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", "--test-concurrency=1", "src/**/*.test.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ACCOUNTING_DB_TEST: "local-only",
      ASSETS_DB_TEST: "local-only",
      PAYMENTS_DB_TEST: "local-only",
      PROCUREMENT_DB_TEST: "local-only",
      AUTHORIZATION_DB_TEST: "local-only",
      CONCURRENCY_DB_TEST: "local-only",
      DATABASE_POOL_MAX: "10",
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
