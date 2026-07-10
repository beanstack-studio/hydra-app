-- ============================================================
-- Add get_station_pending_invites() SECURITY DEFINER RPC
--
-- Root cause of invite sync bug: the invitations table has an
-- RLS policy (invitations_read_own) that only lets a user read
-- their OWN invitation row (email = auth.email()). The station
-- owner cannot SELECT pending invites for their station through a
-- normal query, so useTeamSettings never knew about pending invites
-- and the UI always showed "Send Invite" on every fresh modal open.
--
-- This function bypasses RLS (SECURITY DEFINER) and returns all
-- pending invitations for the caller's station, restricted to the
-- owner role. Mirrors the existing get_station_staff_emails() pattern.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_station_pending_invites()
RETURNS TABLE (id uuid, email text, full_name text, invited_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_station_id uuid;
  v_role       text;
BEGIN
  SELECT station_id, role INTO v_station_id, v_role
  FROM   public.users
  WHERE  id = v_uid;

  -- Only station owners may fetch pending invites for their station.
  -- Staff members have no need to see this data.
  IF v_station_id IS NULL OR v_role != 'owner' THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT i.id, i.email, i.full_name, i.invited_at
    FROM   public.invitations i
    WHERE  i.station_id = v_station_id
      AND  i.status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_station_pending_invites() TO authenticated;
