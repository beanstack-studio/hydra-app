-- Filter Replacement Tracker
-- Logs each time an owner marks their water filter as replaced.
-- The app counts refill containers sold since MAX(replaced_at) to determine
-- how overdue the filter is.

CREATE TABLE IF NOT EXISTS filter_replacements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id      uuid        NOT NULL,
  replaced_at     timestamptz NOT NULL DEFAULT now(),
  slim_count_at_replacement  integer NOT NULL DEFAULT 0,
  round_count_at_replacement integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE filter_replacements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "station_isolation"
  ON filter_replacements
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'user_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'user_metadata' ->> 'station_id')::uuid);

CREATE INDEX IF NOT EXISTS filter_replacements_station_replaced_at
  ON filter_replacements (station_id, replaced_at DESC);
