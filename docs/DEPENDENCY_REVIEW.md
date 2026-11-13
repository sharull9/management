# Dependency review — 2026-11-13

This pass resolved the outstanding production advisories. `pnpm audit --prod` went from 17 vulnerabilities (2 low, 8 moderate, 7 high) to zero, and the full `pnpm audit` went from 29 (4 low, 16 moderate, 9 high) to one low advisory that has no published fix.

## Changes

Direct dependency bumps:

- `zod` `^4.6.5` → `^4.6.7` (GHSA-mrhx-c7xc-m3w5, high). The `zod@4` override also converges transitive zod 4.x consumers (`@workflow/*` pinned `~4.5.4`, `@vercel/cli-*` pinned `4.1.11`) onto 4.6.7. Dev-only `zod@3.25.76` consumers (`shadcn`, `@modelcontextprotocol/sdk`, `zod-to-json-schema`) are untouched.
- `shadcn` `^4.21.4` → `4.23.0` (devDependency). This removed the vulnerable `@modelcontextprotocol/sdk`, `express`, `hono`, `@hono/node-server`, `body-parser`, `qs`, `ip-address`, and `systeminformation` subgraphs entirely.

`pnpm.overrides` additions in `pnpm-workspace.yaml`:

| Override | Was | Advisory notes |
| --- | --- | --- |
| `fast-uri: 3.1.9` | 3.1.8 | Three advisories (two moderate, one low) via `ajv` in `@hookform/resolvers` and `@prisma/dev`. |
| `undici: 7.30.2` | 7.30.0 | Six advisories (four high, two moderate) via `@workflow/world-*` and `workflow`. |
| `mysql2: 3.24.6` | 3.15.3 | Two advisories (one high, one moderate). `prisma` pins `3.15.3` exactly; the app uses PostgreSQL through `@prisma/adapter-pg` and never opens a MySQL connection. `better-auth` (`^3.0.0`) and `drizzle-orm` (`>=2`) peers still accept the override. |
| `deepmerge-ts: 8.0.2` | 7.1.5 | GHSA-ggr8-5vv4-36mx (high). `@prisma/config` pins `7.1.5`; major 8 is the only patched line. Verified by `prisma generate` and `next build`. |
| `minimatch@>=9: 11.0.4` | 9.0.9 / 10.2.6 | GHSA-g3hv-75wg-m249 (moderate). Patched only in the 11.x line; `minimatch@5.1.9` (unaffected) is left alone. Consumers: `@vercel/queue`, `@oclif/core`, `@swc/cli`, `@ts-morph/common`. |

`allowBuilds` placeholders for `@swc/core` and `cbor-extract` were set to `false`, matching the existing `pnpm.ignoredBuiltDependencies` entries; the literal placeholder strings were breaking `pnpm install`'s exit status and every `pnpm run` deps check.

## Remaining advisory (deferred)

| Package | Advisory | Why deferred |
| --- | --- | --- |
| deepmerge 4.3.1 | [Prototype poisoning in `mergeObject()`](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) (low) | Patched version `>=4.3.2` does not exist in the registry (latest is 4.3.1). Reached only through devDependency `shadcn` and `@shadcn/registry`, which merge registry manifests at CLI runtime — not shipped to production. Re-check when `deepmerge@4.3.2` or a `shadcn` release pulling it is published. |

## Verification

- `pnpm audit --prod`: 0 vulnerabilities.
- `pnpm audit`: 1 low (`deepmerge`, above).
- `pnpm typecheck`, `pnpm lint` (five pre-existing warnings), `pnpm check:boundaries`, `pnpm test` (261 pass, 17 skip, 0 fail), and `pnpm build` all pass. `next@16.4.3` builds without the Next.js security stop. Build requires a `DATABASE_URL` (placeholder is sufficient) and generated route types (`pnpm exec next typegen` or a prior `next dev`/`build`).

Repeat `pnpm audit` when upgrading Workflow, Prisma, Better Auth, or CLI tooling. Verification uses frozen installs in CI; production builds must not install floating versions independently of the committed lockfile.
