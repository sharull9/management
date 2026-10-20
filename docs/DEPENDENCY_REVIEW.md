# Dependency review — 2026-10-20

The improvement pass pins Workflow's transitive `devalue` to 5.9.3 and its Nano ID 5 dependency to 5.1.16 in `pnpm-workspace.yaml`. These stay within their existing major versions. The lockfile records both resolutions. `shadcn` is development tooling and now lives in `devDependencies`.

After these changes, `pnpm audit --prod --json` reports two high and one moderate advisories, all outside the patched serialization dependencies:

| Package | Advisory | Current exposure and decision |
| --- | --- | --- |
| deepmerge-ts 7.1.5 | [Recursive object graphs exhaust the stack](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | Prisma configuration dependency. Application code does not merge untrusted recursive objects through it. The published fix requires major version 8; retain Prisma's supported dependency until an upstream update or separately verified migration. |
| mysql2 3.15.3 | [Authentication plugin downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) | Optional adapter dependency. This application uses PostgreSQL through `@prisma/adapter-pg` and does not establish MySQL connections. Reassess before enabling a MySQL adapter. |
| mysql2 3.15.3 | [Unbounded compressed protocol inflation](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) | Same unused MySQL connection path. The advisory lists 3.23.1 as patched. Prefer the owning package's update; there is no reachable MySQL transport in this application. |

The complete development graph also flags `braces` through CLI tooling. The registry checked during this pass offered 3.0.3 as latest and did not contain the suggested 3.0.4 patch. No nonexistent override was added. Development dependencies must remain outside the production runtime image.

These are reachability assessments, not a claim that the dependency graph is advisory free. Repeat `pnpm audit` when upgrading Workflow, Prisma, Better Auth, or CLI tooling. Verification uses frozen installs in CI; production builds must not install floating versions independently of the committed lockfile.
