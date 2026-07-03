-- ============================================================
-- Ensure RLS is enabled on supplies table
--
-- The supplies_station_member policy created in migration
-- 20260703000001 has no effect unless RLS is actually enabled.
-- ENABLE ROW LEVEL SECURITY is idempotent — safe to run if
-- RLS was already enabled.
-- ============================================================

ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
