-- Drop is_retailer column from customers.
-- Confirmed zero references to is_retailer in types, hooks, or components.
-- Customer type (walk-in / regular / retailer) is tracked via the `type` column.

ALTER TABLE customers DROP COLUMN IF EXISTS is_retailer;
