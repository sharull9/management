-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "account_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "systemKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "systemKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_sources" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "fingerprint" TEXT,
    "currentEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "accountingSourceId" TEXT,
    "revision" INTEGER,
    "reversalOfId" TEXT,
    "approvalRequestId" TEXT,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "partyId" TEXT,
    "taxComponentId" TEXT,
    "taxName" TEXT,
    "taxRate" DECIMAL(18,4),
    "taxBaseAmount" DECIMAL(18,2),

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_templates_tenantId_code_key" ON "account_templates"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "account_templates_tenantId_systemKey_key" ON "account_templates"("tenantId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_organizationId_code_key" ON "ledger_accounts"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_organizationId_systemKey_key" ON "ledger_accounts"("organizationId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_id_organizationId_key" ON "ledger_accounts"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_sources_currentEntryId_key" ON "accounting_sources"("currentEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_sources_organizationId_sourceType_sourceId_key" ON "accounting_sources"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_sources_id_organizationId_key" ON "accounting_sources"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_sources_currentEntryId_organizationId_key" ON "accounting_sources"("currentEntryId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOfId_key" ON "journal_entries"("reversalOfId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_approvalRequestId_key" ON "journal_entries"("approvalRequestId");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_status_date_idx" ON "journal_entries"("organizationId", "status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_organizationId_code_key" ON "journal_entries"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_id_organizationId_key" ON "journal_entries"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_accountingSourceId_revision_key" ON "journal_entries"("accountingSourceId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOfId_organizationId_key" ON "journal_entries"("reversalOfId", "organizationId");

-- CreateIndex
CREATE INDEX "journal_lines_organizationId_accountId_journalEntryId_idx" ON "journal_lines"("organizationId", "accountId", "journalEntryId");

-- CreateIndex
CREATE INDEX "journal_lines_projectId_idx" ON "journal_lines"("projectId");

-- CreateIndex
CREATE INDEX "journal_lines_partyId_idx" ON "journal_lines"("partyId");

-- CreateIndex
CREATE INDEX "journal_lines_taxComponentId_idx" ON "journal_lines"("taxComponentId");

-- AddForeignKey
ALTER TABLE "account_templates" ADD CONSTRAINT "account_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "account_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_sources" ADD CONSTRAINT "accounting_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_sources" ADD CONSTRAINT "accounting_sources_currentEntryId_organizationId_fkey" FOREIGN KEY ("currentEntryId", "organizationId") REFERENCES "journal_entries"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_accountingSourceId_organizationId_fkey" FOREIGN KEY ("accountingSourceId", "organizationId") REFERENCES "accounting_sources"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_organizationId_fkey" FOREIGN KEY ("reversalOfId", "organizationId") REFERENCES "journal_entries"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_organizationId_fkey" FOREIGN KEY ("journalEntryId", "organizationId") REFERENCES "journal_entries"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_organizationId_fkey" FOREIGN KEY ("accountId", "organizationId") REFERENCES "ledger_accounts"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_taxComponentId_fkey" FOREIGN KEY ("taxComponentId") REFERENCES "tax_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Amount invariants are enforced in the database as well as at the service boundary.
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "journal_lines_amounts_nonnegative_check" CHECK ("debit" >= 0 AND "credit" >= 0),
  ADD CONSTRAINT "journal_lines_exactly_one_side_check" CHECK (("debit" > 0) <> ("credit" > 0)),
  ADD CONSTRAINT "journal_lines_tax_rate_nonnegative_check" CHECK ("taxRate" IS NULL OR "taxRate" >= 0);
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_revision_nonnegative_check" CHECK ("revision" IS NULL OR "revision" >= 0);
ALTER TABLE "accounting_sources"
  ADD CONSTRAINT "accounting_sources_revision_nonnegative_check" CHECK ("revision" >= 0);

CREATE FUNCTION "protect_ledger_account_changes"() RETURNS trigger AS $$
BEGIN
  IF OLD."systemKey" IS NOT NULL AND
     (NEW."systemKey" IS DISTINCT FROM OLD."systemKey" OR
      NEW."type" IS DISTINCT FROM OLD."type" OR
      (OLD."active" AND NOT NEW."active")) THEN
    RAISE EXCEPTION 'System account keys, types, and active status are protected' USING ERRCODE = '55000';
  END IF;
  IF OLD."systemKey" IS NULL AND NEW."type" IS DISTINCT FROM OLD."type" AND EXISTS (
    SELECT 1 FROM "journal_lines" AS line
    JOIN "journal_entries" AS entry ON entry."id" = line."journalEntryId"
    WHERE line."accountId" = OLD."id" AND line."organizationId" = OLD."organizationId"
      AND entry."status" = 'POSTED'
  ) THEN
    RAISE EXCEPTION 'An account type cannot change after posted activity' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_accounts_protected_changes"
BEFORE UPDATE ON "ledger_accounts"
FOR EACH ROW EXECUTE FUNCTION "protect_ledger_account_changes"();

CREATE FUNCTION "protect_posted_journal"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'Posted journal entries are immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_entries_posted_immutable"
BEFORE UPDATE OR DELETE ON "journal_entries"
FOR EACH ROW EXECUTE FUNCTION "protect_posted_journal"();

CREATE FUNCTION "protect_journal_line_mutation"() RETURNS trigger AS $$
DECLARE
  parent_id TEXT;
  parent_org TEXT;
  parent_status "JournalStatus";
  old_parent_status "JournalStatus";
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."journalEntryId" ELSE NEW."journalEntryId" END;
  parent_org := CASE WHEN TG_OP = 'DELETE' THEN OLD."organizationId" ELSE NEW."organizationId" END;
  SELECT "status" INTO parent_status FROM "journal_entries"
    WHERE "id" = parent_id AND "organizationId" = parent_org;
  IF parent_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Journal lines can only be changed while the parent is DRAFT' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT "status" INTO old_parent_status FROM "journal_entries"
      WHERE "id" = OLD."journalEntryId" AND "organizationId" = OLD."organizationId";
    IF old_parent_status IS DISTINCT FROM 'DRAFT' THEN
      RAISE EXCEPTION 'Journal lines can only be changed while the parent is DRAFT' USING ERRCODE = '55000';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_lines_parent_draft_only"
BEFORE INSERT OR UPDATE OR DELETE ON "journal_lines"
FOR EACH ROW EXECUTE FUNCTION "protect_journal_line_mutation"();

CREATE FUNCTION "assert_posted_journal_balanced"() RETURNS trigger AS $$
DECLARE
  target_id TEXT;
  target_status "JournalStatus";
  line_count BIGINT;
  debit_total NUMERIC;
  credit_total NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    target_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    target_id := OLD."journalEntryId";
  ELSE
    target_id := NEW."journalEntryId";
  END IF;
  SELECT "status" INTO target_status FROM "journal_entries" WHERE "id" = target_id;
  IF target_status = 'POSTED' THEN
    SELECT COUNT(*), COALESCE(SUM("debit"), 0), COALESCE(SUM("credit"), 0)
      INTO line_count, debit_total, credit_total
      FROM "journal_lines" WHERE "journalEntryId" = target_id;
    IF line_count < 2 OR debit_total <= 0 OR debit_total <> credit_total THEN
      RAISE EXCEPTION 'A POSTED journal requires at least two lines and equal non-zero debit and credit totals'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "journal_entries_posted_balanced"
AFTER INSERT OR UPDATE ON "journal_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_posted_journal_balanced"();

CREATE CONSTRAINT TRIGGER "journal_lines_posted_balanced"
AFTER INSERT OR UPDATE OR DELETE ON "journal_lines"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_posted_journal_balanced"();



