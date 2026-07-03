-- ============================================================
-- Fix 1: protect accept_invitation() from corrupting owner accounts
--
-- Root cause: accept_invitation() hardcodes role='staff' and
-- uses ON CONFLICT DO UPDATE, so if an owner somehow has a pending
-- invitation (e.g. self-invite during testing), every sign-in:
--   1. accept_invitation() updates their users row to role='staff'
--   2. refreshSession() rotates the refresh token
--   3. TOKEN_REFRESHED fires a second loadSession
--   4. Second loadSession hits accept_invitation() again (idempotent)
--   5. Second refreshSession() uses the already-rotated token → 400
--
-- Fix: bail early if the caller already has an owner row in users.
-- Also: update email on conflict so it's never null after acceptance.
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_email         text;
  v_inv           invitations%ROWTYPE;
  v_existing_role text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Could not resolve caller email');
  END IF;

  -- Guard: never downgrade an existing owner to staff.
  -- This prevents stale invitations (e.g. self-invites) from corrupting the
  -- owner's role and triggering the refresh-token 400 loop.
  SELECT role INTO v_existing_role FROM public.users WHERE id = v_uid;
  IF v_existing_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'Caller is already a station owner');
  END IF;

  -- Accept both pending and already-accepted invitations (idempotent).
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE email = v_email
    AND status IN ('pending', 'accepted')
  ORDER BY invited_at DESC
  LIMIT 1;

  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('error', 'No invitation found');
  END IF;

  -- Stamp the users row; also update email so it is never null after acceptance.
  INSERT INTO public.users (id, email, station_id, role)
  VALUES (v_uid, v_email, v_inv.station_id, 'staff')
  ON CONFLICT (id) DO UPDATE
    SET station_id = EXCLUDED.station_id,
        role       = EXCLUDED.role,
        email      = COALESCE(EXCLUDED.email, public.users.email);

  UPDATE public.invitations SET status = 'accepted' WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'station_id', v_inv.station_id,
    'role',       'staff'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation() TO authenticated;

-- ============================================================
-- Fix 2: remove the stale self-invite for the test station owner.
-- This invitation was created when the owner accidentally sent
-- an invite to their own email address during testing. It is
-- what caused accept_invitation() to fire on every owner sign-in.
-- ============================================================
DELETE FROM public.invitations
WHERE email = 'biancacmatira@gmail.com'
  AND status = 'pending';

-- ============================================================
-- Fix 3: backfill null emails in public.users from auth.users.
-- Some older rows were created before the email column was
-- reliably populated by accept_invitation().
-- ============================================================
UPDATE public.users pu
SET    email = au.email
FROM   auth.users au
WHERE  au.id = pu.id
  AND  pu.email IS NULL;

-- ============================================================
-- Fix 4: add get_station_staff_emails() RPC
--
-- The users table RLS only allows reading your own row.
-- The owner cannot see staff users' email addresses through
-- a plain SELECT, so activeEmails in useTeamSettings was
-- always returning an empty Set, making hasAccess always false.
--
-- This SECURITY DEFINER function bypasses RLS and returns the
-- emails of all staff members in the caller's station.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_station_staff_emails()
RETURNS TABLE (email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_station_id uuid;
BEGIN
  SELECT station_id INTO v_station_id FROM public.users WHERE id = v_uid;

  IF v_station_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT u.email
    FROM   public.users u
    WHERE  u.station_id = v_station_id
      AND  u.role = 'staff'
      AND  u.email IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_station_staff_emails() TO authenticated;
