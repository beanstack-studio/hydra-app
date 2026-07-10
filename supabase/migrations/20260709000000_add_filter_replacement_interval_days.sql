-- Replace the day-of-month filter schedule with an interval-based system.
--
-- filter_replacement_interval_days: how many days between replacements.
-- filter_replacement_day (legacy column) is kept in place so existing rows
-- are not broken; the app no longer reads or writes it.
--
-- Existing rows get a clean 30-day default — no attempt to convert a stored
-- day-of-month value into an equivalent interval.

ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS filter_replacement_interval_days integer
  CHECK (filter_replacement_interval_days >= 1);

UPDATE station_settings
SET filter_replacement_interval_days = 30
WHERE filter_replacement_interval_days IS NULL;
