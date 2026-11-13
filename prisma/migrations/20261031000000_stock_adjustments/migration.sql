ALTER TABLE "stock_movements" ADD COLUMN "reason" TEXT,
  ADD COLUMN "recordedById" TEXT;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
