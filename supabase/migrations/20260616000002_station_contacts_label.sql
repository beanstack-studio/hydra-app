-- Ensure station_contacts table exists with correct schema.
-- The table was created manually in the dashboard; this migration
-- adds the label column that the app expects.

CREATE TABLE IF NOT EXISTS public.station_contacts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid        NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('mobile', 'landline', 'messenger', 'email')),
  value      text        NOT NULL,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- If the table already exists without label, add it
ALTER TABLE public.station_contacts ADD COLUMN IF NOT EXISTS label TEXT;

-- RLS
ALTER TABLE public.station_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'station_contacts'
      AND policyname = 'station_contacts_own_station'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY station_contacts_own_station ON public.station_contacts
        USING (station_id = (auth.jwt() ->> 'station_id')::uuid)
        WITH CHECK (station_id = (auth.jwt() ->> 'station_id')::uuid)
    $policy$;
  END IF;
END $$;
