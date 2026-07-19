-- ============================================================
-- Add search_sales_by_order_suffix(p_station_id, p_suffix) RPC
--
-- Problem: sales.id is typed uuid.  PostgREST cannot ILIKE a uuid
-- column via the Supabase JS client:
--   .or()     → inline ::text cast breaks the logic-tree parser (400)
--   .filter() → URLSearchParams encodes :: as %3A%3A so PostgREST
--               never sees the cast
--
-- This function does id::text right() in real SQL so order-number
-- search ("9A65CE" / "#9A65CE") works across ALL sales, not just
-- the ~1 000-row client-side scan window.
--
-- The displayed order number is the last 6 characters of the UUID
-- (id.slice(-6).toUpperCase() in the UI), so right(id::text, 6)
-- is the exact server-side equivalent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_sales_by_order_suffix(
  p_station_id uuid,
  p_suffix     text
)
RETURNS SETOF public.sales
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM   public.sales
  WHERE  station_id = p_station_id
    AND  right(id::text, 6) ILIKE '%' || p_suffix || '%'
  ORDER  BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_sales_by_order_suffix(uuid, text) TO authenticated;
