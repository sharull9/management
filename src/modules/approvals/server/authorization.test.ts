import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("approval manager lookups deduplicate within one request and keep scopes separate", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
      import assert from 'node:assert/strict';
      const { canActOnStep, registerManagerResolver } = await import('./src/modules/approvals/server/authorization.ts');
      let calls = 0;
      registerManagerResolver(async () => { calls++; return ['manager']; });
      const ctx = { user: { id: 'manager' }, org: { id: 'org' }, member: null, isAdmin: false };
      const request = { organizationId: 'org', projectId: 'project', stageId: 'stage', status: 'PENDING' };
      const step = { approverType: 'PROJECT_MANAGER', status: 'PENDING' };
      const cache = new Map();
      assert.deepEqual(await Promise.all(Array.from({ length: 50 }, () => canActOnStep(ctx, step, request, undefined, cache))), Array(50).fill(true));
      assert.equal(calls, 1);
      await canActOnStep(ctx, step, { ...request, projectId: 'other' }, undefined, cache);
      await canActOnStep(ctx, { ...step, approverType: 'STAGE_MANAGER' }, request, undefined, cache);
      assert.equal(calls, 3);
      await canActOnStep(ctx, step, request, undefined, new Map());
      assert.equal(calls, 4);
      assert.equal(await canActOnStep(ctx, step, { ...request, organizationId: 'foreign' }, undefined, cache), false);
      assert.equal(calls, 4);
      console.log('passed');
    `,
    ],
    { encoding: "utf8", cwd: process.cwd() },
  );
  assert.match(output, /passed/);
});
