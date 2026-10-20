# Purchase-order close and cancel

Implemented on 18 October 2026 using GPT-6 Luna subagents on the `codex` account, with at most three active at once.

Orders now have permission-gated Close order and Cancel order confirmations on their detail page. The actions require project access and `purchase.order.create`. Existing pending-approval cancellation still returns the document to draft.

- Cancel accepts draft and approved orders with no received quantities, active receipts or active bills.
- Close accepts approved, partially received and received orders. Draft and pending receipts block closure. Existing bills remain available.
- Both operations lock and re-read the PO, update its status and record an audit in one transaction. Repeating the same operation does not add another audit.
- Receipt saves now acquire the same PO lock before checking its status. Receipt approval and linked bill writes already use that lock.
- Closing or cancelling does not post or reverse accounting entries. Historical receipts, bills and journals remain intact.

The existing shared tab strip now scrolls within the available width on phones.

## Verification

The opt-in `order-terminal.integration.test.ts` passed against the isolated loopback database. Its fixtures roll back. Coverage includes allowed transitions, invalid transitions, active receipt/bill blockers, received quantities, closed-order receipt rejection, permission and organization/project isolation, and audit retries. Set `PROCUREMENT_DB_TEST=local-only`, a loopback `DATABASE_URL` and `DATABASE_POOL_MAX=2` to run it locally.

The full unit suite passed 231 tests, with eight opt-in database scenarios skipped. TypeScript, module boundaries, focused Biome and the production build passed. Independent code review found no confirmed remaining defect.

Collaborative preview verified abandoning the confirmation, terminal cancellation, terminal closure, removal of terminal controls, and the draft-receipt error. Confirmation controls fit a 390-pixel viewport. A transient local database connection error required restarting the test server before completing browser checks.

No schema migration, production database change, commit, push or deployment was performed. Existing Phase 4/5 work was preserved. This does not add reopening, stock adjustments, or release unused quantities from closed orders back to their purchase requests. Concurrent operations were reviewed through their shared lock ordering; no separate multi-client load test was run.
