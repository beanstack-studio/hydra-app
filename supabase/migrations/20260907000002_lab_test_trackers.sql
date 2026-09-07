-- ============================================================
-- Lab Test Trackers — Bacteriological & Physical/Chemical
--
-- DOH-mandated water quality analysis for Philippine water
-- refilling stations:
--   • Bacteriological test — every 30 days (monthly)
--   • Physical & chemical test — every 180 days (6 months)
--
-- Both follow the same pattern as filter_replacement_logs:
-- one row per test event, interval configured in station_settings,
-- zone computed in-app (green / yellow / red).
-- ============================================================

-- ── Bacteriological Test Logs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bacteriological_test_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  uuid        NOT NULL,
  tested_at   timestamptz NOT NULL DEFAULT now(),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bacteriological_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "station_isolation"
  ON bacteriological_test_logs
  FOR ALL TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);

CREATE INDEX IF NOT EXISTS bacteriological_test_logs_station_tested_at
  ON bacteriological_test_logs (station_id, tested_at DESC);

-- ── Physical & Chemical Test Logs ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS physical_chemical_test_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  uuid        NOT NULL,
  tested_at   timestamptz NOT NULL DEFAULT now(),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE physical_chemical_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "station_isolation"
  ON physical_chemical_test_logs
  FOR ALL TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);

CREATE INDEX IF NOT EXISTS physical_chemical_test_logs_station_tested_at
  ON physical_chemical_test_logs (station_id, tested_at DESC);

-- ── station_settings columns ─────────────────────────────────────────────────
-- NULL = not configured (same convention as filter_replacement_interval_days).

ALTER TABLE station_settings
  ADD COLUMN IF NOT EXISTS bacteriological_test_interval_days   integer CHECK (bacteriological_test_interval_days >= 1),
  ADD COLUMN IF NOT EXISTS bacteriological_test_alert_enabled   boolean,
  ADD COLUMN IF NOT EXISTS physical_chemical_test_interval_days  integer CHECK (physical_chemical_test_interval_days >= 1),
  ADD COLUMN IF NOT EXISTS physical_chemical_test_alert_enabled  boolean;

-- ── get_bacteriological_test_history RPC ─────────────────────────────────────
-- Mirrors get_filter_replacement_history exactly. Returns all test events
-- for a station most-recent-first, with days elapsed since the previous event.

CREATE OR REPLACE FUNCTION public.get_bacteriological_test_history(p_station_id uuid)
RETURNS TABLE (
  id              uuid,
  tested_at       timestamptz,
  notes           text,
  days_since_prev integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    id,
    tested_at,
    notes,
    ROUND(
      EXTRACT(EPOCH FROM
        (tested_at - LAG(tested_at) OVER (ORDER BY tested_at ASC))
      ) / 86400.0
    )::integer AS days_since_prev
  FROM   bacteriological_test_logs
  WHERE  station_id = p_station_id
  ORDER  BY tested_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_bacteriological_test_history(uuid) TO authenticated;

-- ── get_physical_chemical_test_history RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_physical_chemical_test_history(p_station_id uuid)
RETURNS TABLE (
  id              uuid,
  tested_at       timestamptz,
  notes           text,
  days_since_prev integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    id,
    tested_at,
    notes,
    ROUND(
      EXTRACT(EPOCH FROM
        (tested_at - LAG(tested_at) OVER (ORDER BY tested_at ASC))
      ) / 86400.0
    )::integer AS days_since_prev
  FROM   physical_chemical_test_logs
  WHERE  station_id = p_station_id
  ORDER  BY tested_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_physical_chemical_test_history(uuid) TO authenticated;
