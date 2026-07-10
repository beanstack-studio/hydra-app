-- Change the DB-level default for both alert flags from true → false.
-- This only affects future INSERT statements that omit these columns
-- (i.e. stations that have never opened either card's settings modal).
-- Existing rows that already have an explicit true value are untouched.
-- The isConfigured gate added to AppShell/Sidebar already prevents alerts
-- from firing for unconfigured stations; this is an additional safeguard.

ALTER TABLE station_settings
  ALTER COLUMN backwash_alert_enabled SET DEFAULT false;

ALTER TABLE station_settings
  ALTER COLUMN filter_replacement_alert_enabled SET DEFAULT false;
