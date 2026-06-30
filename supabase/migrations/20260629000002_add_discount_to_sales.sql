-- Add discount_amount to sales so applied discounts are stored and visible
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0 NOT NULL;
