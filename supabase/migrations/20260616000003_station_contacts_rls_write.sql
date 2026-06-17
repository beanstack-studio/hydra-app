-- Ensure station_contacts has a permissive policy for INSERT/UPDATE/DELETE.
-- The manually-created policy may only cover SELECT (USING without WITH CHECK).
-- Drop and recreate with full CRUD coverage.

DROP POLICY IF EXISTS station_contacts_own_station ON public.station_contacts;
DROP POLICY IF EXISTS "station_contacts: own station" ON public.station_contacts;
DROP POLICY IF EXISTS "Users can manage their own station contacts" ON public.station_contacts;
DROP POLICY IF EXISTS "Enable all for station members" ON public.station_contacts;

-- Single permissive policy covering SELECT + INSERT + UPDATE + DELETE
CREATE POLICY station_contacts_station_member ON public.station_contacts
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);
