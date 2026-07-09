-- Rename Filter Replacement Tracker → Backwash Tracker
--
-- Renames the table and columns to use "backwash" terminology.
-- Uses ALTER TABLE / ALTER COLUMN so existing data is preserved.

-- 1. Drop the existing RLS policy before renaming the table
DROP POLICY IF EXISTS "station_isolation" ON filter_replacements;

-- 2. Rename the table
ALTER TABLE filter_replacements RENAME TO backwash_logs;

-- 3. Rename columns
ALTER TABLE backwash_logs RENAME COLUMN replaced_at                TO backwashed_at;
ALTER TABLE backwash_logs RENAME COLUMN slim_count_at_replacement  TO slim_count_at_backwash;
ALTER TABLE backwash_logs RENAME COLUMN round_count_at_replacement TO round_count_at_backwash;

-- 4. Rename the index
ALTER INDEX IF EXISTS filter_replacements_station_replaced_at
  RENAME TO backwash_logs_station_backwashed_at;

-- 5. Re-create the RLS policy on the renamed table
ALTER TABLE backwash_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "station_isolation"
  ON backwash_logs
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);
