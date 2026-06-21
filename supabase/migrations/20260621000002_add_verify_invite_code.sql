-- Create the verify_invite_code() RPC used by LoginPage.tsx when an invited
-- staff member sets up their password. LoginPage calls this to confirm the
-- 6-character temp_code from the invite email matches what was stored in the
-- invitations table before allowing the user to set a new password.
--
-- SECURITY DEFINER: bypasses RLS so the function can read invitations
-- for the calling user's email even before station_id is in their JWT.

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
  -- Resolve the caller's email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF v_email IS NULL THEN
    RETURN false;
  END IF;

  -- Match against the most recent pending invitation for this email
  SELECT COUNT(*) INTO v_count
  FROM public.invitations
  WHERE email    = v_email
    AND status   = 'pending'
    AND UPPER(TRIM(temp_code)) = UPPER(TRIM(p_code));

  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_invite_code(text) TO authenticated;
