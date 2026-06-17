-- Drop the legacy key-value settings table — zero references in the app.
-- station_settings (separate table) is used instead.
DROP TABLE IF EXISTS public.settings CASCADE;
