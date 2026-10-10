# Phase 2 implementation report

Implemented on `build/foundation`. No Phase 3 or later modules were added. No push was performed.
The placeholder `.env` was preserved. Generated Prisma files, local database credentials and
stored photos are excluded from commits.

## Built

- Fourteen models: Project, ProjectSite, ProjectBudgetLine, ProjectMember, Stage, Task,
  TaskAssignment, TaskSubmission, TaskDelayRequest, Worker, ProjectWorker, Attendance, Expense
  and CostEntry. Project/stage approval scope IDs now have real foreign keys. The existing
  TASK_SUBMISSION, TASK_DELAY and EXPENSE document enum values were reused.
- New schema and integrity migrations. Integrity checks cover nonnegative amounts/rates,
  valid date ranges, progress, coordinates and attendance cost reconciliation. Partial indexes
  prevent multiple pending submissions/delays for a task. Cost source uniqueness prevents
  duplicate attendance/expense ledger entries.
- `/[org]/projects`: status/search filters, client/manager/dates/budget/spent/usage, create/edit
  project and quick customer creation. PRJ, TSK and EXP document series supply their numbers.
- Project overview, stages, grouped task list/detail, team, attendance, costs, budget and sites.
  Task detail supports worker assignment, start, submission on behalf of a worker, progress,
  photos, delay requests, approval timelines and audit history.
- `/[org]/workforce`: workers, tenant designations and worker availability for a date range.
  Workers have no login account. Project assignment permits explicit overlap confirmation,
  blocks inactive workers and blocks ambiguous overlapping rates within one project.
- `/[org]`: active projects, budget usage, monthly spending per currency, actionable pending
  approvals and overdue tasks. Cost visibility follows project permissions, including scoped
  manager/custom-role access.
- Private photo download at `/api/attachments/[attachmentId]`, with org/project authorization,
  nosniff and private/no-store responses. Uploads use the existing storage abstraction and
  clean up files when the submission transaction fails.
- Zod server actions in `src/server/projects/actions.ts`, reusable existing ActionForm/Field/
  SelectField/FormCard/shadcn patterns, and Sonner feedback. All runtime pages/layouts wrap
  data reads in Suspense and use loading boundaries.
- Project DAL authorization, scoped custom roles and manager permissions; audited mutations
  and approval effects. Foundation member/role deletion now checks project references.

## Approval integration

The approval service imports `src/server/approvals/register.ts` directly. Pages do not need
side-effect imports. Each final decision and its domain effects share the engine transaction.
Handlers receive the actual actor ID for the domain audit trail.

- TASK_SUBMISSION approval marks the task COMPLETED, progress 100 and completedAt. Rejection
  marks it REWORK. Cancellation marks the submission CANCELED and returns the task to IN_PROGRESS.
- TASK_DELAY approval copies proposedDueDate to the task. Rejection/cancellation update the
  delay status without changing the due date.
- EXPENSE approval marks the source approved and upserts its CostEntry. Rejection/cancellation
  update source status and do not post costs. The expense amount is passed into the request
  for minAmount filtering.
- PROJECT_MANAGER resolves Project.managerUserId plus ProjectMember.isManager users.
  STAGE_MANAGER resolves only Stage.managerUserId. Missing managers use the engine's admin
  fallback. Manager selection has a pure unit test, including missing stage managers.
- The policy editor supports org/project/stage scopes and preserves them during edits.
  Both policy writes and approval submission validate ownership and stage/project consistency.
- Approval inbox/history have meaningful source titles and links to task detail or project costs.
- Transactional submission accepts the action's already verified OrgContext as its third
  argument. This avoids opening DAL/session reads outside a held Prisma dev transaction.

## Costing

Money uses Prisma Decimal, with a cloned 48-digit arithmetic context.

1. Day rate is dayRateOverride if provided, including zero. Otherwise MONTHLY is salary divided
   by costDaysPerMonth; DAILY is salary; HOURLY is salary times standardHoursPerDay.
2. Base day cost multiplies that rate by 1 for PRESENT, 0.5 for HALF_DAY, or 0 for ABSENT/LEAVE.
3. OT cost is overtimeHours times otHourlyRateOverride, or day rate divided by standard hours
   times overtimeMultiplier. For monthly pay, the same ratio is calculated as salary times
   multiplier divided by cost days times standard hours, avoiding recurring-division rounding
   at a half-cent boundary.
4. Day and OT amounts round half up to two decimal places separately. Total is their sum.
   Hours worked are recorded independently of the status factor. Entered OT remains a separate
   component, including on a day whose base factor is zero.
5. Saving/editing attendance upserts one LABOUR CostEntry keyed by org/source type/attendance ID
   inside the same transaction. Deleting attendance removes and audits its ledger entry.
   Saved amounts remain snapshots until an explicit edit/save.

## Design choices and limits

- Tasks use the plan's list option, grouped by stage, rather than adding a second board view.
- Stages reorder by editing their sequence number; equal sequences have a deterministic ID
  tie-break. Referenced stages cannot be deleted, preserving source/history relationships.
- Actual budget comparisons use cost type plus stage. Multiple lines with the same pair share
  the matching actual, with combined totals above the individual comparisons. This avoids
  pretending to allocate costs to a budget line ID absent from CostEntry.
- Attendance labour remains unallocated to stage/task, as attendance records a project and
  worker. Expenses can allocate to a stage/task.
- Project currencies are stored and dashboard totals are separated per currency. No exchange
  conversion was added. Assignment rate overrides must be expressed in project currency when
  worker base pay uses a different currency.
- The work includes the requested core flow, not an exhaustive browser regression of every
  create/edit/delete form or every permission combination. No load/concurrency benchmark or
  production deployment was performed.
- The local fixture scripts intentionally provision test identities directly and require an
  explicit local-only flag. Their password is supplied by shell environment and is not in a file.

## Validation

Final quality gates passed: `pnpm prisma validate`, `pnpm prisma generate`,
`pnpm exec tsc --noEmit`, `pnpm format`, `pnpm lint`, `pnpm test` and `pnpm build`.
The test command runs 11 tests with Node's `--import tsx --test`. The build used the unchanged
placeholder `.env` and made no database connection. All app routes prerender their static shell.

Local migrations and seed passed on a clean named Prisma dev instance. For the already running
server's local default database, a migrate diff verified an exact foundation schema match before
baselining the two foundation migrations and applying only the additive Phase 2 migrations.
There were no organizations in that database before creating the smoke fixture. No existing
data was deleted. Prisma dev required its separate TCP shadow endpoint.

T3 collaborative browser smoke results:

- Created project PRJ-0001, its customer, Groundwork stage, TSK-0001 and a monthly worker.
  Assigned worker to project and task, started work, and saved present attendance with two OT hours.
- Day cost 1000.00, OT 375.00, total 1375.00. The labour ledger row appeared immediately.
  Editing to HALF_DAY replaced it with 875.00; deleting removed it; restoring attendance created
  exactly one 1375.00 labour source entry.
- Delay approval through the inbox changed due date from 2026-10-15 to 2026-10-20.
- Submitted work at 95% on behalf of the worker with a PNG. Inbox approval completed the task
  at 100%, set completedAt and preserved the timeline. Authorized download returned 200,
  image/png and the stored 68 bytes.
- EXP-0001 approval posted 1250.50 of MATERIAL cost to Groundwork. Overview and dashboard showed
  total 2625.50, remaining 7374.50 and budget used 26.26% against 10000.00.
- A stage EXPENSE policy with thresholds 1000.00 and 10000.00 snapshot only its STAGE_MANAGER
  step for EXP-0002 at 2000.00. Rejection posted no cost.
- A restricted org member with no custom role viewed only their assigned project and had no
  cost/edit/create access. An unassigned project was denied. After project-manager assignment,
  the same user could create a stage, view scoped dashboard costs and manage budget/sites.
- Changed Groundwork's stage manager to that non-admin user. EXP-0003 appeared in their inbox
  and not the owner's; the member rejected it. This verified real manager resolution instead
  of an administrator bypass.
- A second project assignment produced an overlap warning, then succeeded only after explicit
  confirmation. A material budget line of 2000.00 compared with actual 1250.50 and remaining
  749.50. Created a site with India/Tamil Nadu selects.
- `scripts/phase2-smoke-verify.ts` independently asserted persisted task/approval states,
  dates, amounts, source uniqueness, attachment bytes, threshold snapshots, audit deletes,
  member approver identity, budget/site records and zero pending project approvals.

## Command log

Repeated invocations are grouped here by command. Inspection commands did not mutate source.
Shell database URLs and the temporary smoke password are omitted.

- `git status --short`, `git log -4 --oneline`, `git branch --show-current`, `git diff --stat`,
  and focused `git diff -- ...`: PASS. Clean initial tree and branch build/foundation verified.
- `Get-Content` of PLAN, README, AGENTS, schema, context, actions, action-result, permissions,
  approval service/authorization/handlers/policy, audit, numbering, storage, db, auth, Prisma
  config, package/config files, existing pages/shell/forms and installed Next guides: PASS.
- Skill reads for Ponytail, Brainstorming, Unslop, React best practices and next-dev-loop: PASS.
  The T3 browser was used for runtime verification; the agent-browser workflow was not invoked.
- `rg --files src/app src/components` and installed Next docs, plus focused `rg -n` searches:
  PASS. Initial reads of nonexistent `forms.tsx` and `approval-policy-editor.tsx` failed;
  corrected to ActionForm and PolicyEditor. A shell glob for compiled chunk names failed;
  corrected to `rg` over the chunk directory.
- Temporary `node scripts/phase2-schema.cjs`: PASS; removed the generation helper afterward.
- `pnpm prisma format`, `pnpm prisma validate`, `pnpm prisma generate`: PASS throughout.
- `pnpm prisma dev --detach`, `pnpm prisma dev ls`,
  `pnpm prisma dev --name management-phase2 --detach`: PASS.
- Inline Node/pg database creation/inspection queries: PASS. Prisma dev's TCP proxy did not
  provide the intended independent database-name isolation; used a named instance instead.
- First `pnpm prisma migrate dev --name phase2_projects_workforce_cost`: FAIL P3006 because
  automatic shadow creation reused a populated template. The attempted same-instance database
  name workaround failed P3005. Re-ran against named primary/shadow endpoints: PASS.
- `pnpm prisma migrate dev` after the integrity migration: PASS on the named instance and
  the baselined default instance. `pnpm db:seed`: PASS on both, including repeated seed runs.
- `New-Item`/`Copy-Item` for a temporary copy of the two foundation migrations: PASS.
  `pnpm prisma migrate diff --from-config-datasource --to-migrations <temporary baseline>
  --script`: PASS, empty diff. `pnpm prisma migrate resolve --applied` for each foundation
  migration: PASS on the matching local default schema.
- `pnpm exec tsx scripts/phase2-smoke-fixture.ts`: PASS on both local instances.
- `pnpm exec next dev --port 3001`: FAIL because the existing checkout dev process held the lock.
  `pnpm exec next start --port 3001`: REJECTED by automatic approval review, “blocked by policy”
  without a further reason. Used the existing server, then restarted that verified repo process.
- `Get-CimInstance` for the exact dev PID and guarded `Stop-Process`: PASS.
  `pnpm dev` with the local database URL only in its shell: PASS. Restart was necessary because
  a route module retained the generated Phase 1 schema after Prisma regeneration.
- Development log reads and compiled-chunk `rg` inspection: PASS, used to diagnose the stale
  Prisma delegate and P2028 transaction timeout. Passing pre-authorized context fixed the latter.
- `pnpm exec biome check --write`: PASS. `pnpm format`: PASS. One early `pnpm lint` failed for
  import order after an edit; safe import organization fixed it. Final `pnpm lint`: PASS.
- `pnpm exec tsc --noEmit`: initial stale .next/dev versus production route types failed;
  refreshing the production build fixed them. Final type checks: PASS.
- `pnpm test`: initial 9/10 because monthly recurring division rounded OT below a half-cent
  boundary. Fixed the calculation. Subsequent 10/10 and final 11/11: PASS.
- `pnpm build`: initial browser Decimal type import failed; fixed the type-only server import.
  A PowerShell default-encoding dashboard write then failed UTF-8 parsing; rewrote as UTF-8.
  Subsequent builds, including the final build with placeholder DATABASE_URL: PASS.
- `pnpm exec tsx scripts/phase2-smoke-verify.ts`: PASS. One later run encountered a transient
  Prisma dev “Connection terminated unexpectedly”; immediate unchanged rerun passed.
- T3 preview status/open/navigation/snapshot/type/select/click/evaluate/wait calls: core smoke
  and access checks PASS after the documented fixes. Initial waits exposed stale client delegates
  and the transaction timeout. A few invalid/ambiguous selectors and a date entry not retained by
  the tool were corrected using inspected form locators/native date values. Native browser
  form resets required re-entering assignment fields after the overlap warning.
- Next dev MCP `get_errors`, via its local HTTP endpoint: PASS with no current session errors.
- Final `git diff --check`, explicit-path `git add`, four `git commit` calls, `git log -4 --oneline`,
  commit-trailer checks and final `git status --short`: recorded in the handoff after commits.

## Handoff

Commit hashes are provided in the final reply. Every commit has the requested Claude Opus 5.5
co-author trailer. The local development server and smoke fixture remain available for inspection.
