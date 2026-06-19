-- Fix owner station link and ensure station is active.
-- Owner d7dc2fe7 was seeing "Account not linked to a station" because
-- the users row may have been corrupted or never stamped correctly.

-- 1. Ensure stations has an is_active column (safe if it already exists)
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Ensure the owner's station is active
UPDATE public.stations
SET    is_active = true
WHERE  id = 'c378be27-9b45-4464-b8ef-61cc0fbb8bee';

-- 3. Fix the owner's users row
INSERT INTO public.users (id, email, station_id, role)
SELECT
  'd7dc2fe7-f19a-4edb-9731-95d09c4adf22'::uuid,
  au.email,
  'c378be27-9b45-4464-b8ef-61cc0fbb8bee'::uuid,
  'owner'
FROM auth.users au
WHERE au.id = 'd7dc2fe7-f19a-4edb-9731-95d09c4adf22'
ON CONFLICT (id) DO UPDATE
  SET station_id = EXCLUDED.station_id,
      role       = EXCLUDED.role;
