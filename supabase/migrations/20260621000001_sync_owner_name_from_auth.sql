-- Sync stations.owner_name using auth.users metadata as the source of truth.
-- The previous migration only used public.users.full_name, which can be null
-- if the owner's name was only ever saved to auth.users.user_metadata (e.g.
-- on initial registration). This migration also checks auth metadata as a
-- fallback, matching the priority order used by the app.
UPDATE public.stations s
SET owner_name = COALESCE(
  NULLIF(TRIM(pu.full_name), ''),
  NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), '')
)
FROM public.users pu
JOIN auth.users au ON au.id = pu.id
WHERE pu.station_id = s.id
  AND pu.role = 'owner'
  AND COALESCE(
    NULLIF(TRIM(pu.full_name), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), '')
  ) IS NOT NULL;
