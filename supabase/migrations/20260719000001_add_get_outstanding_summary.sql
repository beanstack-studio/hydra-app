-- ============================================================
-- Add get_outstanding_summary(p_station_id) RPC
--
-- Replaces the unbounded raw table scan:
--   SELECT customer_name, balance_due FROM sales
--   WHERE station_id = ? AND balance_due > 0     ← no limit, no date filter
--   (silently capped at 1 000 rows by PostgREST)
--
-- This function does the SUM and TOP-5 ranking entirely in Postgres
-- so the result is always correct regardless of total sales volume,
-- and requires only a single round-trip instead of fetching all rows.
--
-- Returns JSON:
--   {
--     "total": 12345.00,
--     "top":   [{ "customer_name": "Arman", "balance_due": 500.00 }, ...]
--   }
--
-- "outstanding" is intentionally NOT date-scoped — it reflects the
-- station's real-time total unpaid balance across all time, shown
-- as a constant alongside the period-scoped totals on the Reports page.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_outstanding_summary(p_station_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH per_customer AS (
    SELECT
      COALESCE(NULLIF(TRIM(customer_name), ''), 'Walk-in') AS customer_name,
      SUM(balance_due)                                       AS balance_due
    FROM   public.sales
    WHERE  station_id = p_station_id
      AND  balance_due > 0
    GROUP  BY COALESCE(NULLIF(TRIM(customer_name), ''), 'Walk-in')
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT SUM(balance_due) FROM per_customer), 0),
    'top',   COALESCE(
               (SELECT json_agg(row_to_json(t))
                FROM   (SELECT customer_name, balance_due
                        FROM   per_customer
                        ORDER  BY balance_due DESC
                        LIMIT  5) t),
               '[]'::json
             )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_outstanding_summary(uuid) TO authenticated;
