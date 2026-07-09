-- Filter Replacement Tracker
-- Logs each time a physical filter cartridge is replaced.
-- Uses app_metadata for station_id (same RLS pattern as all other tables).

CREATE TABLE IF NOT EXISTS filter_replacement_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  uuid        NOT NULL,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE filter_replacement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "station_isolation"
  ON filter_replacement_logs
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);

CREATE INDEX IF NOT EXISTS filter_replacement_logs_station_replaced_at
  ON filter_replacement_logs (station_id, replaced_at DESC);
