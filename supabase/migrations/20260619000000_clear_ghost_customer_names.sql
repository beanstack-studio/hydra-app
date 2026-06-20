-- Clear ghost customer names in sales so they display as "Unknown" in the UI.
-- Targets walk-in / no-name placeholder values typed in by users before the
-- One Time customer type existed.
UPDATE public.sales
SET customer_name = ''
WHERE lower(trim(customer_name)) IN ('no name', 'no-name', 'walk in', 'walk-in');
