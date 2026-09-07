-- ============================================================
-- get_bills_badge_zone(p_station_id, p_today) RPC
--
-- Problem: useBillsBadge.ts fetched ALL monthly_bills rows via
-- PostgREST's .select('*') with no LIMIT. PostgREST silently caps
-- results at 1 000 rows — the same class of bug already fixed for
-- customers (get_customers_with_stats) and sales
-- (search_sales_by_order_suffix, get_outstanding_summary). A station
-- with a long bill history would silently get a wrong badge zone.
--
-- This function mirrors computeRecurringState() (recurringAlerts.ts)
-- exactly, running entirely in Postgres so no PostgREST row cap applies.
-- Returns 'red' | 'yellow' | 'green'.
--
-- p_today: caller passes the PHT-local date (yyyy-mm-dd) so no
--          server-side timezone conversion is required.
--
-- Zone logic (matches the TypeScript exactly):
--   red    – at least one recurring series has urgency 'red'
--             (reminder_day has already passed this month)
--   yellow – at least one series has urgency 'yellow' (within 5 days),
--             OR bills exist but none logged for the current period
--   green  – no actionable alerts
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_bills_badge_zone(
  p_station_id uuid,
  p_today      date
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_has_red       boolean := false;
  v_has_yellow    boolean := false;
  v_no_current    boolean := false;
  v_total_count   int;
  v_current_count int;
  v_cur_month     int;
  v_cur_year      int;
  v_cur_day       int;
  v_yellow_lead   int := 5;
  v_elapsed       int;
  v_interval      int;
  v_is_due        boolean;
  v_days_to       int;
  rec             RECORD;
BEGIN
  v_cur_month := EXTRACT(MONTH FROM p_today)::int;
  v_cur_year  := EXTRACT(YEAR  FROM p_today)::int;
  v_cur_day   := EXTRACT(DAY   FROM p_today)::int;

  -- noCurrentPeriodBills: station has bills but none for this month.
  -- Equivalent to: bills.length > 0 && !bills.some(b => b.month === cur && b.year === cur)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE month = v_cur_month AND year = v_cur_year)
  INTO v_total_count, v_current_count
  FROM monthly_bills
  WHERE station_id = p_station_id;

  IF v_total_count > 0 AND v_current_count = 0 THEN
    v_no_current := true;
  END IF;

  -- Per-series recurring alert check (mirrors computeRecurringState).
  -- For each series keyed by (bill_type, description):
  --   • skip if no bill in the series has is_recurring = true
  --   • skip if a bill already exists for the current period
  --   • skip if payment_cap is reached
  --   • skip if current month is not a scheduled due month (cadence guard)
  --   • compute urgency from reminder_day vs today's day-of-month
  FOR rec IN
    WITH series AS (
      SELECT
        bill_type,
        description,
        COUNT(*)                                                       AS bill_count,
        -- Anchor = earliest recurring bill (fixes the cadence schedule)
        MIN(CASE WHEN is_recurring THEN year * 12 + month END)         AS anchor_ym,
        -- Most recent recurring bill = source of live cadence/reminder settings
        MAX(CASE WHEN is_recurring THEN year * 12 + month END)         AS recent_ym,
        MAX(CASE WHEN is_recurring THEN 1 ELSE 0 END)                  AS has_recurring,
        MAX(CASE WHEN year = v_cur_year AND month = v_cur_month
                 THEN 1 ELSE 0 END)                                    AS has_current
      FROM monthly_bills
      WHERE station_id = p_station_id
      GROUP BY bill_type, description
    )
    SELECT
      s.bill_count,
      r.recurrence_cadence,
      r.recurrence_interval_months,
      COALESCE(r.reminder_day, 1)                         AS reminder_day,
      r.payment_cap,
      -- Recover anchor year/month from the ym key (year*12+month):
      --   anchor_year  = (anchor_ym - 1) / 12  (integer division)
      --   anchor_month = anchor_ym - anchor_year * 12
      (s.anchor_ym - 1) / 12                             AS anchor_year,
      s.anchor_ym - ((s.anchor_ym - 1) / 12) * 12        AS anchor_month
    FROM series s
    -- Join back to get the most-recent recurring bill's cadence settings
    JOIN monthly_bills r
      ON  r.station_id   = p_station_id
      AND r.bill_type    IS NOT DISTINCT FROM s.bill_type
      AND r.description  IS NOT DISTINCT FROM s.description
      AND r.is_recurring = true
      AND r.year * 12 + r.month = s.recent_ym
    WHERE s.has_recurring = 1
      AND s.has_current   = 0
      AND (r.payment_cap IS NULL OR s.bill_count < r.payment_cap)
  LOOP
    -- Elapsed months from anchor to current period (matches JS: (curYear-anchorYear)*12 + (curMonth-anchorMonth))
    v_elapsed := (v_cur_year - rec.anchor_year) * 12 + (v_cur_month - rec.anchor_month);

    -- Cadence guard: is current month a scheduled due month?
    CASE rec.recurrence_cadence
      WHEN 'quarterly' THEN
        v_is_due := v_elapsed > 0 AND v_elapsed % 3 = 0;
      WHEN 'custom' THEN
        v_interval := GREATEST(1, COALESCE(rec.recurrence_interval_months, 1));
        v_is_due   := v_elapsed > 0 AND v_elapsed % v_interval = 0;
      ELSE  -- NULL or 'monthly': always due
        v_is_due := true;
    END CASE;

    CONTINUE WHEN NOT v_is_due;

    -- Urgency: how many days until reminder_day?
    v_days_to := rec.reminder_day - v_cur_day;
    IF    v_days_to <= 0             THEN v_has_red    := true;
    ELSIF v_days_to <= v_yellow_lead THEN v_has_yellow := true;
    END IF;
  END LOOP;

  IF v_has_red                    THEN RETURN 'red';    END IF;
  IF v_has_yellow OR v_no_current THEN RETURN 'yellow'; END IF;
  RETURN 'green';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bills_badge_zone(uuid, date) TO authenticated;
