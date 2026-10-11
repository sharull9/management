import assert from "node:assert/strict";
import { test } from "node:test";
import { setWorld } from "workflow/runtime";
import { register } from "./instrumentation";

test("instrumentation starts only the selected Node Postgres worker and awaits errors", async () => {
  const runtime = process.env.NEXT_RUNTIME;
  const target = process.env.WORKFLOW_TARGET_WORLD;
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
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.WORKFLOW_TARGET_WORLD = "@workflow/world-postgres";
    await register();
    assert.equal(starts, 1);
    setWorld({
      specVersion: 8,
      start: async () => {
        throw new Error("Worker unavailable");
      },
    } as unknown as Parameters<typeof setWorld>[0]);
    await assert.rejects(register(), /Worker unavailable/);
  } finally {
    setWorld(undefined);
    if (runtime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = runtime;
    if (target === undefined) delete process.env.WORKFLOW_TARGET_WORLD;
    else process.env.WORKFLOW_TARGET_WORLD = target;
  }
});
