
-- Add created_by column to track who registered each payment
ALTER TABLE loan_payments ADD COLUMN created_by UUID DEFAULT auth.uid();

-- Backfill existing records: assume owner registered them
UPDATE loan_payments SET created_by = user_id WHERE created_by IS NULL;

-- Make it NOT NULL going forward
ALTER TABLE loan_payments ALTER COLUMN created_by SET NOT NULL;
