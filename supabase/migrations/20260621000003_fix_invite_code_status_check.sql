-- Fix invite acceptance flow broken by the handle_new_user trigger.
--
-- Root cause: inviteUserByEmail() creates a new auth user, which fires the
-- handle_new_user trigger. That trigger calls accept_invitation(), marking the
-- invitation status = 'accepted' before the staff member ever sees the form.
-- invite-staff then deletes the auto-created public.users row (orphan cleanup).
-- Result: invitation is 'accepted' but users row is gone, and verify_invite_code
-- checks status = 'pending' so it always returns false → "Incorrect code".
--
-- Fix: make both functions status-agnostic (idempotent):
--   1. verify_invite_code — match by email + code only (no status filter)
--   2. accept_invitation  — accept status IN ('pending', 'accepted') so the
--      user still gets linked to the station after setting their password

-- ── 1. verify_invite_code ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_invite_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_count int;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN false; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.invitations
  WHERE email = v_email
    AND UPPER(TRIM(temp_code)) = UPPER(TRIM(p_code));
    -- No status filter: the trigger may have already set status='accepted'
    -- before the staff member opens the form. The email+code pair is enough
    -- to prove identity.

  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_invite_code(text) TO authenticated;

-- ── 2. accept_invitation ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   invitations%ROWTYPE;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Could not resolve caller email');
  END IF;

  -- Accept both pending and already-accepted invitations (idempotent).
  -- The handle_new_user trigger may have already marked it accepted, but the
  -- public.users row might have been deleted by invite-staff cleanup.
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE email = v_email
    AND status IN ('pending', 'accepted')
  ORDER BY invited_at DESC
  LIMIT 1;

  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('error', 'No invitation found');
  END IF;

  -- Stamp/restore the users row (insert if missing, update if present)
  INSERT INTO public.users (id, email, station_id, role)
  VALUES (v_uid, v_email, v_inv.station_id, 'staff')
  ON CONFLICT (id) DO UPDATE
    SET station_id = EXCLUDED.station_id,
        role       = EXCLUDED.role;

  -- Mark accepted (no-op if already accepted)
  UPDATE public.invitations SET status = 'accepted' WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'station_id', v_inv.station_id,
    'role',       'staff'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation() TO authenticated;
