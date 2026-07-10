-- Migration 20260709000000 eagerly backfilled filter_replacement_interval_days = 30
-- for all existing station_settings rows, including stations that had never
-- configured filter replacement at all. This prevents the "not configured"
-- placeholder from appearing for those stations.
--
-- Reverse the backfill for stations that never used either the old
-- day-of-month system (filter_replacement_day IS NULL) OR the new interval
-- system (interval was only ever the migration default of 30, not owner-set).
-- After this migration, those stations will correctly show the unconfigured
-- placeholder card and the owner can set a real value via the settings modal.

UPDATE station_settings
SET filter_replacement_interval_days = NULL
WHERE filter_replacement_day IS NULL
  AND filter_replacement_interval_days = 30;
