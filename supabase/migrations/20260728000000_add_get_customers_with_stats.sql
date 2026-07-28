-- ============================================================
-- Add get_customers_with_stats(p_station_id) RPC
--
-- Replaces the nested sales() subquery in useCustomers.ts:
--   .select('*, sales(sale_date, balance_due, status)')
--   (silently capped at 1 000 rows by PostgREST — both the outer
--   customer list and any embedded relation aggregation)
--
-- This function computes last_ordered_at and total_balance entirely
-- in Postgres via a single LEFT JOIN + GROUP BY, so the figures are
-- always correct regardless of how many sales a customer has.
--
-- Returns one row per customer for the station, ordered by name.
-- Customers with no sales get last_ordered_at = NULL, total_balance = 0.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_customers_with_stats(p_station_id uuid)
RETURNS TABLE (
  id              uuid,
  station_id      uuid,
  name            text,
  type            text,
  phone           text,
  messenger       text,
  address         text,
  created_at      timestamptz,
  last_ordered_at date,
  total_balance   numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.station_id,
    c.name,
    c.type::text,
    c.phone,
    c.messenger,
    c.address,
    c.created_at,
    MAX(s.sale_date)                                              AS last_ordered_at,
    COALESCE(
      SUM(CASE WHEN s.status IN ('unpaid', 'partial')
               THEN s.balance_due
               ELSE 0
          END),
      0
    )                                                             AS total_balance
  FROM   public.customers c
  LEFT JOIN public.sales s
         ON s.customer_id = c.id
        AND s.station_id  = c.station_id
  WHERE  c.station_id = p_station_id
  GROUP  BY c.id, c.station_id, c.name, c.type,
            c.phone, c.messenger, c.address, c.created_at
  ORDER  BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_customers_with_stats(uuid) TO authenticated;
