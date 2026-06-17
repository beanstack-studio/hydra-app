-- Drop the stations.address column — never read by the app.
-- Business address lives in station_settings.business_address instead.
ALTER TABLE public.stations DROP COLUMN IF EXISTS address;
