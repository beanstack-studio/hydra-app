-- ============================================================
-- get_bills_badge_zone — add unpaid due-date check
--
-- Extends the existing RPC to also surface bills that are unpaid
-- and have a due_date within the alert window.  This mirrors the new
-- computeUnpaidDueAlerts() function in recurringAlerts.ts exactly.
--
-- The two checks are kept deliberately separate in code so a future
-- reader can verify they match without hunting across both files:
--
--   TypeScript (recurringAlerts.ts → computeUnpaidDueAlerts):
--     daysUntilDue = dueNorm - todayNorm   (calendar days)
--     daysUntilDue <= 0            → red    (today or overdue)
--     1 ≤ daysUntilDue ≤ 5        → yellow  (within 5 days)
--     no due_date / already paid   → skip
--
--   SQL (this function, "Unpaid due-date check" block below):
--     due_date::date <= p_today    → red
--     due_date::date  > p_today
--       AND (due_date::date - p_today) <= 5 → yellow
--     date_paid IS NOT NULL        → excluded via WHERE
--     due_date  IS NULL            → excluded via WHERE
--
-- Zone precedence is unchanged: red beats yellow beats green.
-- Either check (recurring cadence OR unpaid due-date) can set red/yellow.
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
  v_has_red            boolean := false;
  v_has_yellow         boolean := false;
  v_no_current         boolean := false;
  v_total_count        int;
  v_current_count      int;
  v_cur_month          int;
  v_cur_year           int;
  v_cur_day            int;
  v_yellow_lead        int := 5;
  v_elapsed            int;
  v_interval           int;
  v_is_due             boolean;
  v_days_to            int;
  -- Unpaid due-date counters
  v_unpaid_overdue     int := 0;
  v_unpaid_upcoming    int := 0;
  rec                  RECORD;
BEGIN
  v_cur_month := EXTRACT(MONTH FROM p_today)::int;
  v_cur_year  := EXTRACT(YEAR  FROM p_today)::int;
  v_cur_day   := EXTRACT(DAY   FROM p_today)::int;

  -- noCurrentPeriodBills: station has bills but none for this month.
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE month = v_cur_month AND year = v_cur_year)
  INTO v_total_count, v_current_count
  FROM monthly_bills
  WHERE station_id = p_station_id;

  IF v_total_count > 0 AND v_current_count = 0 THEN
    v_no_current := true;
  END IF;

  -- ── Recurring cadence alert check (unchanged from original) ──────────────
  FOR rec IN
    WITH series AS (
      SELECT
        bill_type,
        description,
        COUNT(*)                                                       AS bill_count,
        MIN(CASE WHEN is_recurring THEN year * 12 + month END)         AS anchor_ym,
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
      (s.anchor_ym - 1) / 12                             AS anchor_year,
      s.anchor_ym - ((s.anchor_ym - 1) / 12) * 12        AS anchor_month
    FROM series s
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
    v_elapsed := (v_cur_year - rec.anchor_year) * 12 + (v_cur_month - rec.anchor_month);

    CASE rec.recurrence_cadence
      WHEN 'quarterly' THEN
        v_is_due := v_elapsed > 0 AND v_elapsed % 3 = 0;
      WHEN 'custom' THEN
        v_interval := GREATEST(1, COALESCE(rec.recurrence_interval_months, 1));
        v_is_due   := v_elapsed > 0 AND v_elapsed % v_interval = 0;
      ELSE
        v_is_due := true;
    END CASE;

    CONTINUE WHEN NOT v_is_due;

    v_days_to := rec.reminder_day - v_cur_day;
    IF    v_days_to <= 0             THEN v_has_red    := true;
    ELSIF v_days_to <= v_yellow_lead THEN v_has_yellow := true;
    END IF;
  END LOOP;

  -- ── Unpaid due-date check (mirrors computeUnpaidDueAlerts in TypeScript) ──
  -- Counts unpaid bills whose due_date is within the alert window.
  -- Bills with no due_date or already paid are excluded by the WHERE clause.
  --
  -- Sync note: YELLOW_LEAD = 5 here matches the TypeScript constant.
  --   red    → due_date <= p_today          (today or already past)
  --   yellow → due_date in (p_today, p_today + 5]
  SELECT
    COUNT(*) FILTER (WHERE due_date::date <= p_today),
    COUNT(*) FILTER (WHERE due_date::date > p_today
                       AND (due_date::date - p_today) <= v_yellow_lead)
  INTO v_unpaid_overdue, v_unpaid_upcoming
  FROM monthly_bills
  WHERE station_id = p_station_id
    AND date_paid  IS NULL
    AND due_date   IS NOT NULL;

  IF v_unpaid_overdue  > 0 THEN v_has_red    := true; END IF;
  IF v_unpaid_upcoming > 0 THEN v_has_yellow := true; END IF;

  -- ── Zone resolution (red > yellow > green) ───────────────────────────────
  IF v_has_red                    THEN RETURN 'red';    END IF;
  IF v_has_yellow OR v_no_current THEN RETURN 'yellow'; END IF;
  RETURN 'green';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bills_badge_zone(uuid, date) TO authenticated;
