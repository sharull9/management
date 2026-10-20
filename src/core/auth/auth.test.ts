import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("all installed organization HTTP endpoints are disabled before authorization data is read", () => {
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
      const { auth } = await import('./src/core/auth/auth.ts');
      const paths = [...new Set(Object.values(auth.api).map(endpoint => endpoint.path).filter(path => path?.startsWith('/organization/')))];
      assert.ok(paths.length >= 10);
      for (const path of paths) {
        for (const method of ['GET', 'POST']) {
          const response = await auth.handler(new Request('http://localhost:3000/api/auth' + path, {
            method,
            ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}),
          }));
          assert.equal(response.status, 404, method + ' ' + path);
        }
      }
      console.log('passed ' + paths.length + ' organization paths');
    `,
    ],
    {
      encoding: "utf8",
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "test-only-organization-endpoint-session-secret",
      },
    },
  );
  assert.match(output, /passed/);
});

test("production sign-in HTTP requests use the installed rate limiter", () => {
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
      const { auth } = await import('./src/core/auth/auth.ts');
      const statuses = [];
      for (let i = 0; i < 4; i++) {
        const response = await auth.handler(new Request('http://localhost:3000/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          body: JSON.stringify({ email: 'invalid', password: '' }),
        }));
        statuses.push(response.status);
      }
      assert.deepEqual(statuses, [400, 400, 400, 429]);
      console.log('passed');
    `,
    ],
    {
      encoding: "utf8",
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
        BETTER_AUTH_URL: "http://localhost:3000",
        BETTER_AUTH_SECRET: "test-only-login-rate-limit-session-secret",
      },
    },
  );
  assert.match(output, /passed/);
});
