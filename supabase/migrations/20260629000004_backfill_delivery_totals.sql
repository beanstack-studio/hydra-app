-- Backfill total_amount for past delivery sales where the now-removed trigger
-- excluded delivery addon items from the total.
--
-- Safety: only touches rows where the sole discrepancy is the delivery addon sum
-- (i.e. the trigger stripped delivery; no other discount was in play).
-- Sales where total_amount is lower by more than the delivery fee are left alone
-- because an unknown discount was also applied and we can't recover that figure.
--
-- For PAID sales: also adjusts amount_received so the sale stays fully paid.
-- For PARTIAL / UNPAID: only updates total_amount (balance_due auto-recalculates
-- as it is a GENERATED column).

WITH item_analysis AS (
  SELECT
    s.id,
    s.status,
    s.total_amount                                                       AS old_total,
    s.discount_amount,

    -- Sum of ALL items in the cart
    (
      SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'price')::numeric), 0)
      FROM   jsonb_array_elements(s.items) AS item
    )                                                                    AS all_sum,

    -- Sum of delivery-named addon items only
    (
      SELECT COALESCE(SUM((item->>'qty')::numeric * (item->>'price')::numeric), 0)
      FROM   jsonb_array_elements(s.items) AS item
      WHERE  (item->>'product_name') ILIKE '%delivery%'
    )                                                                    AS delivery_sum

  FROM  sales s
  WHERE s.order_type = 'delivery'
    AND s.items IS NOT NULL
    AND jsonb_array_length(s.items) > 0
)
UPDATE sales
SET
  total_amount    = a.all_sum - COALESCE(a.discount_amount, 0),
  amount_received = CASE
                      WHEN a.status = 'paid'
                        THEN a.all_sum - COALESCE(a.discount_amount, 0)
                      ELSE sales.amount_received
                    END
FROM item_analysis a
WHERE sales.id = a.id
  -- Only fix rows where missing delivery is the only discrepancy
  AND a.delivery_sum > 0
  AND ABS((a.all_sum - a.delivery_sum - COALESCE(a.discount_amount, 0)) - a.old_total) < 0.01;
