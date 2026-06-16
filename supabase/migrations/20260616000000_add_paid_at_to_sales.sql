-- Add paid_at column to track when a sale was fully settled
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;

-- Backfill: best-effort stamp for already-paid sales
UPDATE sales SET paid_at = created_at WHERE status = 'paid' AND paid_at IS NULL;
