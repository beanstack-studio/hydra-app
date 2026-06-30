-- Revert migration 20260629000004: restore original total_amount and
-- amount_received for delivery sales that were incorrectly bumped to include
-- the delivery fee. The correct approach is to leave total_amount as-is and
-- instead set discount_amount to reflect any gap (see next migration).
--
-- Identifies changed rows by the fact that their current total_amount now
-- equals the full items sum (i.e. no gap remains after the previous backfill).

WITH item_analysis AS (
  SELECT
    s.id,
    s.status,
    -- Sum of ALL items
    (
      SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'price')::numeric), 0)
      FROM   jsonb_array_elements(s.items) AS item
    )                                                            AS all_sum,
    -- Sum of delivery-named items only
    (
      SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'price')::numeric), 0)
      FROM   jsonb_array_elements(s.items) AS item
      WHERE  (item->>'product_name') ILIKE '%delivery%'
    )                                                            AS delivery_sum
  FROM  sales s
  WHERE s.order_type = 'delivery'
    AND s.items IS NOT NULL
    AND jsonb_array_length(s.items) > 0
)
UPDATE sales
SET
  total_amount    = a.all_sum - a.delivery_sum,
  amount_received = CASE
                      WHEN a.status = 'paid'
                        THEN a.all_sum - a.delivery_sum
                      ELSE sales.amount_received
                    END
FROM item_analysis a
WHERE sales.id = a.id
  -- Only rows where the backfill closed the gap (total now equals full items sum)
  AND a.delivery_sum > 0
  AND ABS(sales.total_amount - a.all_sum) < 0.01;
