-- Add temp/permanent tracking for uploaded order design files (Option A)

ALTER TABLE order_files
ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'order_files';

ALTER TABLE order_files
ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE order_files
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'temporary';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_files_status_check'
  ) THEN
    ALTER TABLE order_files
    ADD CONSTRAINT order_files_status_check
    CHECK (status IN ('temporary', 'permanent')) NOT VALID;
  END IF;
END $$;

ALTER TABLE order_files VALIDATE CONSTRAINT order_files_status_check;

UPDATE order_files
SET status = 'permanent'
WHERE status IS NULL AND order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_files_status ON order_files(status);
