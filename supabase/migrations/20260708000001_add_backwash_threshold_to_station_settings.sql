-- Add configurable backwash threshold to station_settings.
-- NULL means "use the app default (300 refills)".
ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS backwash_threshold integer;
