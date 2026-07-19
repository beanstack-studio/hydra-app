-- ============================================================
-- get_backwash_history(p_station_id)
--
-- Returns all backwash events for a station, most recent first.
-- For each event, computes the total slim+round refills sold
-- strictly AFTER the previous backwash date up to and including
-- the current backwash date (mirrors the JS countRefillsFromSale
-- logic already used in useBackwashTracker.ts).
--
-- refills_since_prev is NULL for the oldest entry (no prior event).
--
-- Handles both new-style (items JSONB array) and legacy
-- (product_name + qty on the sale row directly) sale records.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_backwash_history(p_station_id uuid)
RETURNS TABLE (
  id                 uuid,
  backwashed_at      timestamptz,
  notes              text,
  refills_since_prev integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ordered_logs AS (
    SELECT
      id,
      backwashed_at,
      notes,
      LAG(backwashed_at) OVER (ORDER BY backwashed_at ASC) AS prev_backwashed_at
    FROM   backwash_logs
    WHERE  station_id = p_station_id
  )
  SELECT
    ol.id,
    ol.backwashed_at,
    ol.notes,
    CASE
      WHEN ol.prev_backwashed_at IS NULL THEN NULL
      ELSE (
        SELECT COALESCE(
          SUM(
            CASE
              -- New-style: items is a non-empty JSONB array — sum matching elements
              WHEN s.items IS NOT NULL AND jsonb_array_length(s.items) > 0
              THEN (
                SELECT COALESCE(SUM((elem->>'qty')::integer), 0)
                FROM   jsonb_array_elements(s.items) AS elem
                WHERE  (elem->>'product_name') ~* 'refill.*(slim|round)'
              )
              -- Legacy: use product_name column directly
              ELSE CASE
                WHEN s.product_name ~* 'refill.*(slim|round)'
                THEN COALESCE(s.qty, 0)
                ELSE 0
              END
            END
          ),
          0
        )
        FROM sales s
        WHERE s.station_id = p_station_id
          -- Strictly after the previous backwash day (PH timezone), matching
          -- the  .gt('sale_date', lastBackwashedDate)  filter in JS.
          AND s.sale_date > (ol.prev_backwashed_at AT TIME ZONE 'Asia/Manila')::date
          -- Up to and including the day of this backwash event.
          AND s.sale_date <= (ol.backwashed_at AT TIME ZONE 'Asia/Manila')::date
      )
    END::integer
  FROM   ordered_logs ol
  ORDER  BY ol.backwashed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_backwash_history(uuid) TO authenticated;


-- ============================================================
-- get_filter_replacement_history(p_station_id)
--
-- Returns all filter replacement events for a station, most
-- recent first.  For each event, computes the number of days
-- elapsed since the previous replacement using the timestamp
-- difference in PHT.
--
-- days_since_prev is NULL for the oldest entry (no prior event).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_filter_replacement_history(p_station_id uuid)
RETURNS TABLE (
  id              uuid,
  replaced_at     timestamptz,
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
    replaced_at,
    notes,
    ROUND(
      EXTRACT(EPOCH FROM
        (replaced_at - LAG(replaced_at) OVER (ORDER BY replaced_at ASC))
      ) / 86400.0
    )::integer AS days_since_prev
  FROM   filter_replacement_logs
  WHERE  station_id = p_station_id
  ORDER  BY replaced_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_filter_replacement_history(uuid) TO authenticated;
