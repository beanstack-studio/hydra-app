-- Sync stations.owner_name from public.users.full_name for all stations
-- where owner_name is stale (differs from the owner's current display name)
UPDATE public.stations s
SET owner_name = u.full_name
FROM public.users u
WHERE u.station_id = s.id
  AND u.role = 'owner'
  AND u.full_name IS NOT NULL
  AND u.full_name <> '';
