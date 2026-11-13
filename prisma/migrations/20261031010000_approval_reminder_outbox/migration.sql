CREATE TABLE "approval_reminder_outbox" (
  "id" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "delayMs" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "runId" TEXT,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "approval_reminder_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "approval_reminder_outbox_status_check" CHECK ("status" IN ('PENDING', 'DELIVERED', 'SKIPPED')),
  CONSTRAINT "approval_reminder_outbox_delay_check" CHECK ("delayMs" > 0 AND "delayMs" < 'Infinity'::float8),
  CONSTRAINT "approval_reminder_outbox_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "approval_request_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "approval_reminder_outbox_stepId_key" ON "approval_reminder_outbox"("stepId");
CREATE INDEX "approval_reminder_outbox_status_availableAt_leaseUntil_idx" ON "approval_reminder_outbox"("status", "availableAt", "leaseUntil");

-- Historical launches may already exist; deterministic notification IDs make replay safe.
-- The historical configured delay is unknown, so backfill uses the 24-hour default.
INSERT INTO "approval_reminder_outbox" ("id", "stepId", "delayMs", "createdAt", "updatedAt")
SELECT 'approval-reminder-outbox:' || s.id, s.id, 86400000, r."createdAt", CURRENT_TIMESTAMP
FROM approval_request_steps s JOIN approval_requests r ON r.id = s."requestId"
WHERE s.status = 'PENDING' AND r.status = 'PENDING'
  AND s.sequence = (SELECT MIN(first_step.sequence) FROM approval_request_steps first_step WHERE first_step."requestId" = r.id)
ON CONFLICT ("stepId") DO NOTHING;
