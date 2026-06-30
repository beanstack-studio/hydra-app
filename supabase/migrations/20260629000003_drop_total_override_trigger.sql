-- Drop any BEFORE INSERT triggers on sales that override total_amount.
-- These were created when delivery was a separate delivery_zone_price column
-- and incorrectly excluded delivery addon cart items from the total.
-- balance_due is a GENERATED column and is unaffected by this change.
DO $$
DECLARE
  v_trig RECORD;
BEGIN
  FOR v_trig IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'sales'
      AND event_manipulation  = 'INSERT'
      AND action_timing       = 'BEFORE'
  LOOP
    RAISE NOTICE 'Dropping trigger: %', v_trig.trigger_name;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.sales', v_trig.trigger_name);
  END LOOP;
END $$;
