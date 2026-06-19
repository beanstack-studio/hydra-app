-- ============================================================
-- Fix invited team member RLS access
--
-- Root cause: the invitation flow (sendInvite) inserts into the
-- invitations table and sends an OTP magic link, but never creates
-- a row in the users table for the invited member. Without a users
-- row containing station_id + role, the Postgres JWT hook cannot
-- stamp app_metadata.station_id into the JWT, so every RLS policy
-- (which checks auth.jwt() -> 'app_metadata' ->> 'station_id')
-- returns NULL and blocks all data access.
--
-- Fixes applied:
-- 1. Immediate: upsert the specific team member's users row.
-- 2. Structural: add status column to invitations.
-- 3. RLS: allow an invited user to SELECT their own invitation row
--    by email so the acceptance function can be called safely.
-- 4. accept_invitation() SECURITY DEFINER function: stamps the
--    users row from the invitations table so the JWT hook picks
--    it up on the next token refresh.
-- ============================================================

-- ── 1. Immediate fix: stamp the specific team member's users row ──────────────
-- Pull their email from auth.users so we never hardcode it.
INSERT INTO public.users (id, email, station_id, role)
SELECT
  '3561a37f-70bb-4861-93e7-3f30d23e6938'::uuid,
  au.email,
  'c378be27-9b45-4464-b8ef-61cc0fbb8bee'::uuid,
  'staff'
FROM auth.users au
WHERE au.id = '3561a37f-70bb-4861-93e7-3f30d23e6938'
ON CONFLICT (id) DO UPDATE
  SET station_id = EXCLUDED.station_id,
      role       = EXCLUDED.role;

-- ── 2. Add status column to invitations (idempotent) ─────────────────────────
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'accepted'));

-- Mark the specific team member's invitation as accepted (if it exists)
UPDATE public.invitations
SET    status = 'accepted'
WHERE  station_id = 'c378be27-9b45-4464-b8ef-61cc0fbb8bee'
  AND  email = (
    SELECT email FROM auth.users
    WHERE id = '3561a37f-70bb-4861-93e7-3f30d23e6938'
  );

-- ── 3. RLS: allow an invited user to read their own invitation row ─────────────
-- Required so the accept_invitation() RPC can be called without a
-- station_id claim already being present in the JWT.
-- SECURITY DEFINER bypasses this anyway, but belt-and-suspenders.
DROP POLICY IF EXISTS invitations_read_own ON public.invitations;
CREATE POLICY invitations_read_own ON public.invitations
  FOR SELECT
  TO authenticated
  USING (email = auth.email());

-- ── 4. SECURITY DEFINER function: accept_invitation() ────────────────────────
-- Called by useAuth.ts when an authenticated user has no station_id yet.
-- Looks up a pending invitation by email, stamps the users row with
-- station_id + role = 'staff', and marks the invitation accepted.
-- SECURITY DEFINER so it bypasses RLS on both invitations and users tables.
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
  -- Resolve the caller's email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Could not resolve caller email');
  END IF;

  -- Find the most recent pending invitation for this email
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE email = v_email
    AND status = 'pending'
  ORDER BY invited_at DESC
  LIMIT 1;

  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('error', 'No pending invitation found');
  END IF;

  -- Stamp the users row (insert if missing, update station_id + role if present)
  INSERT INTO public.users (id, email, station_id, role)
  VALUES (v_uid, v_email, v_inv.station_id, 'staff')
  ON CONFLICT (id) DO UPDATE
    SET station_id = EXCLUDED.station_id,
        role       = EXCLUDED.role;

  -- Mark the invitation as accepted
  UPDATE public.invitations SET status = 'accepted' WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'station_id', v_inv.station_id,
    'role',       'staff'
  );
END;
$$;

-- Grant execute to all authenticated users (the function checks auth.uid() internally)
GRANT EXECUTE ON FUNCTION public.accept_invitation() TO authenticated;
