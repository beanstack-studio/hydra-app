-- Add the day-of-month on which filters should be physically replaced.
-- NULL = not yet configured. Values 1–31.
-- Day-clamping for short months (e.g. day 31 in February) is handled in the app,
-- not the DB, so the stored value is always the owner's intended day.
ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS filter_replacement_day integer
  CHECK (filter_replacement_day BETWEEN 1 AND 31);
