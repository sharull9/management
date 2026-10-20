import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("typed actions validate on the server, retain field errors, and preserve redirects", () => {
  // The server-only condition keeps this check independent of Next's request runtime.
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
    import { z } from 'zod';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    // Standalone Node does not apply Next's server navigation alias.
    require.cache[require.resolve('next/navigation')] = { exports: require('next/dist/api/navigation.react-server.js') };
    const { typedAction } = await import('./src/core/typed-action.ts');
    const { runAction } = await import('./src/core/action-result.ts');
    const { UserFacingError } = await import('./src/core/errors.ts');
    const { Prisma } = await import('./src/generated/prisma/client.ts');
    const schema = z.object({ rows: z.array(z.object({ name: z.string().min(2, 'Too short').regex(/^A/, 'Must start with A') })) });
    let called = false;
    const invalid = await typedAction(schema, async () => { called = true; return undefined; })({ rows: [{ name: '' }] });
    assert.equal(called, false);
    assert.deepEqual(invalid.fieldErrors, { 'rows.0.name': ['Too short', 'Must start with A'] });
    assert.equal(invalid.error, 'Too short Must start with A');
    assert.equal(typeof invalid.version, 'number');
    const root = await runAction(async () => { throw new z.ZodError([{ code: 'custom', path: [], message: 'Invalid form' }]); });
    assert.deepEqual(root.fieldErrors, { '': ['Invalid form'] });
    const special = await runAction(async () => { throw new z.ZodError([{ code: 'custom', path: ['__proto__'], message: 'Invalid key' }]); });
    assert.deepEqual(Object.keys(special.fieldErrors), ['__proto__']);
    const transformed = await typedAction(z.object({ name: z.string().trim() }), async ({ name }) => { assert.equal(name, 'Alice'); throw new UserFacingError('Handler reached'); })({ name: ' Alice ' });
    assert.equal(transformed.error, 'Handler reached');
    const logs = [];
    const logError = console.error;
    console.error = (...args) => logs.push(args);
    const unexpected = await runAction(async () => { throw new Error('private-internal-sentinel'); });
    const databaseFailure = await runAction(async () => { throw new Prisma.PrismaClientKnownRequestError('private-database-sentinel', { code:'P2028', clientVersion:'test', meta:{private:'private-meta-sentinel'} }); });
    console.error = logError;
    assert.match(unexpected.error, /Unable to save.*Reference:/);
    assert.doesNotMatch(unexpected.error, /private-internal-sentinel/);
    assert.doesNotMatch(JSON.stringify(logs), /private-internal-sentinel/);
    assert.equal(logs[0][1].name, 'Error');
    assert.equal(typeof logs[0][1].reference, 'string');
    assert.match(databaseFailure.error, /Reference:/);
    assert.equal(logs[1][1].code, 'P2028');
    assert.doesNotMatch(JSON.stringify(logs), /private-database-sentinel|private-meta-sentinel/);
    await assert.rejects(typedAction(z.object({}), async () => '/sign-in')({}), /NEXT_REDIRECT/);
    console.log('passed');
  `,
    ],
    { encoding: "utf8", cwd: process.cwd() },
  );
  assert.match(output, /passed/);
});
