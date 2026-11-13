import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { test } from "node:test";
import { setWorld } from "workflow/runtime";
import { register } from "./instrumentation";

test("instrumentation starts only the selected Node Postgres worker and awaits errors", async () => {
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
  const state = globalThis as typeof globalThis & {
    __instrumentationReminderStarts?: number;
  };
  state.__instrumentationReminderStarts = 0;
  const stubUrl = new URL("./instrumentation.test-worker.ts", import.meta.url)
    .href;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier === "./modules/approvals/server/reminder-worker"
        ? { url: stubUrl, shortCircuit: true }
        : next(specifier, context);
    },
  });
  const runtime = process.env.NEXT_RUNTIME;
  const target = process.env.WORKFLOW_TARGET_WORLD;
  const nodeEnv = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: "test" });
  let starts = 0;
  setWorld({
    specVersion: 8,
    start: async () => {
      starts++;
    },
  } as unknown as Parameters<typeof setWorld>[0]);
  try {
    for (const [runtime, target] of [
      ["edge", "@workflow/world-postgres"],
      ["nodejs", "@workflow/world-local"],
      ["nodejs", ""],
    ]) {
      process.env.NEXT_RUNTIME = runtime;
      process.env.WORKFLOW_TARGET_WORLD = target;
      await register();
    }
    assert.equal(starts, 0);
    assert.equal(state.__instrumentationReminderStarts, 0);
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.WORKFLOW_TARGET_WORLD = "@workflow/world-postgres";
    await register();
    assert.equal(starts, 1);
    assert.equal(state.__instrumentationReminderStarts, 1);
    setWorld({
      specVersion: 8,
      start: async () => {
        throw new Error("Worker unavailable");
      },
    } as unknown as Parameters<typeof setWorld>[0]);
    await assert.rejects(register(), /Worker unavailable/);
    assert.equal(state.__instrumentationReminderStarts, 1);
    Object.assign(process.env, {
      NODE_ENV: "development",
      WORKFLOW_TARGET_WORLD: "",
    });
    await register();
    assert.equal(state.__instrumentationReminderStarts, 2);
  } finally {
    hooks.deregister();
    delete state.__instrumentationReminderStarts;
    if (nodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: nodeEnv });
    setWorld(undefined);
    if (runtime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = runtime;
    if (target === undefined) delete process.env.WORKFLOW_TARGET_WORLD;
    else process.env.WORKFLOW_TARGET_WORLD = target;
  }
});
