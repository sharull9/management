-- Prisma does not express CHECK constraints or partial unique indexes.
ALTER TABLE item_level_definitions ADD CONSTRAINT item_level_range CHECK (level BETWEEN 1 AND 5);
ALTER TABLE tax_identifiers ADD CONSTRAINT tax_identifier_owner CHECK (("partyId" IS NOT NULL)::int + ("organizationId" IS NOT NULL)::int = 1);
ALTER TABLE uoms ADD CONSTRAINT uom_positive_factor CHECK (factor > 0);
ALTER TABLE document_series ADD CONSTRAINT document_series_bounds CHECK (padding BETWEEN 1 AND 12 AND "nextNumber" > 0);
ALTER TABLE approval_policies ADD CONSTRAINT approval_scope CHECK ("stageId" IS NULL OR "projectId" IS NOT NULL);
ALTER TABLE approval_requests ADD CONSTRAINT approval_nonnegative_amount CHECK (amount IS NULL OR amount >= 0);
CREATE UNIQUE INDEX approval_one_pending_document ON approval_requests ("organizationId", "documentType", "documentId") WHERE status = 'PENDING';
