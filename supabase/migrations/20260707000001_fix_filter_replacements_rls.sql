-- Fix filter_replacements RLS policy
--
-- The original migration used auth.jwt() -> 'user_metadata' ->> 'station_id'
-- but station_id is stamped into app_metadata by the JWT hook (not user_metadata).
-- This caused every INSERT and SELECT to fail with 403 Forbidden because
-- user_metadata.station_id is always NULL, making the USING/WITH CHECK condition
-- evaluate to NULL = uuid → false for every authenticated user.
--
-- Fix: drop the broken policy and recreate it with app_metadata, matching
-- the pattern used by every other station-scoped table in this schema.

DROP POLICY IF EXISTS "station_isolation" ON filter_replacements;

CREATE POLICY "station_isolation"
  ON filter_replacements
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);
