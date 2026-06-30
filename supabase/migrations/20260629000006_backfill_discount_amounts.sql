-- Backfill discount_amount for all sales from 2026-06-18 onward where the
-- sum of items in the JSONB exceeds total_amount.
--
-- The gap (items_sum - total_amount) represents a discount that was applied
-- at the time of recording but not stored — either because:
--   a) The DB trigger excluded delivery addon items from total_amount, or
--   b) A manual discount was entered in the form before discount_amount was stored.
--
-- DO NOT touch total_amount. Only set discount_amount = gap.
-- SaleDetailModal already shows "Discount applied −₱X" when discount_amount > 0.

WITH gaps AS (
  SELECT
    s.id,
    ROUND(
      (
        SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'price')::numeric), 0)
        FROM   jsonb_array_elements(s.items) AS item
      ) - s.total_amount,
    2) AS gap
  FROM  sales s
  WHERE s.items IS NOT NULL
    AND jsonb_array_length(s.items) > 0
    AND s.sale_date >= '2026-06-18'
)
UPDATE sales
SET    discount_amount = g.gap
FROM   gaps g
WHERE  sales.id = g.id
  AND  g.gap > 0.009;
