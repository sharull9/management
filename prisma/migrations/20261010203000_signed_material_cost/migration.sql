-- Transfers reverse receipt-recognized material cost; bills can reduce PO cost.
-- All other sources and all non-material costs retain the nonnegative rule.
ALTER TABLE cost_entries DROP CONSTRAINT cost_entry_amount;
ALTER TABLE cost_entries ADD CONSTRAINT cost_entry_amount CHECK (
  amount >= 0 OR (
    "costType" = 'MATERIAL' AND "sourceType" IN ('TRANSFER', 'BILL_VARIANCE')
  )
);
