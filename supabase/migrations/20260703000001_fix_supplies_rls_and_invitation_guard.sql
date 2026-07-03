-- ============================================================
-- Fix 1: supplies table RLS — allow staff to INSERT/UPDATE
--
-- When staff records a supply expense, useExpenses.addExpense()
-- also inserts/updates the supplies table (adds qty, updates
-- price_per_unit, store, last_purchased_at). If the supplies
-- table restricts writes to owners only, this update silently
-- fails and the inventory is never updated.
--
-- Staff already have write access implicitly (deductForSale
-- calls supplies.update when recording a sale), but the policy
-- may have been set to owner-only in the Supabase dashboard.
-- This migration drops any restrictive write policies and
-- replaces them with a single permissive station-member policy.
-- ============================================================

-- Drop common owner-only policy name variants (idempotent)
DROP POLICY IF EXISTS "Enable all for station owner"   ON public.supplies;
DROP POLICY IF EXISTS "Enable write for station owner"  ON public.supplies;
DROP POLICY IF EXISTS supplies_owner_only               ON public.supplies;
DROP POLICY IF EXISTS supplies_write_owner              ON public.supplies;
DROP POLICY IF EXISTS supplies_all_owner                ON public.supplies;
DROP POLICY IF EXISTS supplies_station_member           ON public.supplies;

-- Single permissive policy: all authenticated station members can
-- SELECT / INSERT / UPDATE / DELETE their own station's supplies.
CREATE POLICY supplies_station_member ON public.supplies
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING      (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid)
  WITH CHECK (station_id = (auth.jwt() -> 'app_metadata' ->> 'station_id')::uuid);

-- ============================================================
-- Fix 2: accept_invitation() — station-aware owner guard
--
-- The previous guard blocked ANY caller whose public.users row
-- has role='owner', regardless of which station they own.
--
-- Problem: Supabase's handle_new_user trigger fires when a new
-- auth user is created (e.g. when a re-invited staff member
-- clicks a new magic link). The trigger creates an orphan station
-- and a users row with role='owner' for that new auth user.
-- The old guard then incorrectly fires for this staff member and
-- blocks accept_invitation() from stamping the correct station.
--
-- Fix: only block if the caller is already an owner of the SAME
-- station as the invitation. An owner of a DIFFERENT station
-- (including an orphan station from handle_new_user) is allowed
-- to accept and be stamped as staff in the invited station.
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              uuid := auth.uid();
  v_email            text;
  v_inv              invitations%ROWTYPE;
  v_existing_role    text;
  v_existing_station uuid;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('error', 'Could not resolve caller email');
  END IF;

  -- Find the most recent pending or accepted invitation for this email.
  -- Accept 'accepted' status too so the function is idempotent (e.g.
  -- TOKEN_REFRESHED fires a second loadSession → second call here).
  SELECT * INTO v_inv
  FROM public.invitations
  WHERE email = v_email
    AND status IN ('pending', 'accepted')
  ORDER BY invited_at DESC
  LIMIT 1;

  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('error', 'No invitation found');
  END IF;

  -- Guard: never downgrade an owner of THIS SAME station to staff.
  -- Uses station-aware check so that:
  --   • A genuine owner who accidentally re-clicks their own invite → blocked ✓
  --   • A re-invited staff member whose handle_new_user trigger created
  --     an orphan 'owner' row for a DIFFERENT station → allowed ✓
  SELECT role, station_id
    INTO v_existing_role, v_existing_station
    FROM public.users
   WHERE id = v_uid;

  IF v_existing_role = 'owner' AND v_existing_station = v_inv.station_id THEN
    RETURN jsonb_build_object('error', 'Caller is already a station owner');
  END IF;

  -- Stamp the users row; update email so it is never null after acceptance.
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
