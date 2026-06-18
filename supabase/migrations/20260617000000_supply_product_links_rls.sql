-- Fix RLS for supply_product_links so station members can INSERT/UPDATE/DELETE
-- 42501 error was thrown because no permissive write policy existed.

DROP POLICY IF EXISTS supply_product_links_station_member ON public.supply_product_links;
DROP POLICY IF EXISTS "station_members_manage_supply_product_links" ON public.supply_product_links;
DROP POLICY IF EXISTS "Enable all for station members" ON public.supply_product_links;

CREATE POLICY supply_product_links_station_member ON public.supply_product_links
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);
