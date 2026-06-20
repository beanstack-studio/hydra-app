-- Delete ghost customer records (No name, Walk in, etc.) created before the
-- One Time customer type existed. First detach any sales that reference them,
-- then delete the customer rows.

-- 1. Null out the customer_id on any sales still linked to ghost customers
UPDATE public.sales
SET customer_id = NULL
WHERE customer_id IN (
  SELECT id FROM public.customers
  WHERE lower(trim(name)) IN ('no name', 'no-name', 'walk in', 'walk-in', 'walk_in', '')
     OR type = 'one_time'
);

-- 2. Delete the ghost customer rows
DELETE FROM public.customers
WHERE lower(trim(name)) IN ('no name', 'no-name', 'walk in', 'walk-in', 'walk_in', '')
   OR type = 'one_time';
