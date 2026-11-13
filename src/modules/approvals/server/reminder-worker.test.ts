import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

test("reminder polling is singleton, retries after errors and stops cleanly", async (context) => {
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
  const stubUrl = new URL("./reminder-worker.test-dispatch.ts", import.meta.url)
    .href;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "./start-reminder")
        return { url: stubUrl, shortCircuit: true };
      const result = next(specifier, context);
      return specifier === "server-only"
        ? { ...result, url: result.url.replace("index.js", "empty.js") }
        : result;
    },
  });
  const state = globalThis as typeof globalThis & {
    __reminderWorkerTestPoll?: () => Promise<number>;
  };
  let polls = 0;
  state.__reminderWorkerTestPoll = async () => {
    polls++;
    if (polls === 1) throw new Error("Simulated outage");
    return 0;
  };
  const { startApprovalReminderWorker, stopApprovalReminderWorker } =
    await import("./reminder-worker");
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    startApprovalReminderWorker();
    startApprovalReminderWorker();
    context.mock.timers.tick(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(polls, 1);
    context.mock.timers.tick(30000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(polls, 2);
    stopApprovalReminderWorker();
    context.mock.timers.tick(60000);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(polls, 2);
    startApprovalReminderWorker();
    context.mock.timers.tick(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(polls, 3);
  } finally {
    stopApprovalReminderWorker();
    context.mock.timers.reset();
    delete state.__reminderWorkerTestPoll;
    hooks.deregister();
  }
});
