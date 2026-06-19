-- Add is_retailer flag to customers.
-- When true, the SaleModal bypasses zero-payment validation so the
-- owner can record a pickup-now / pay-later sale for bulk buyers.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_retailer boolean NOT NULL DEFAULT false;
