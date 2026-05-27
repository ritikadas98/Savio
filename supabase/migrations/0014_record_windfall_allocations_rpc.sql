-- 0014_record_windfall_allocations_rpc.sql
--
-- Phase 3 C2 — Lock-in RPC for the WindfallFlow allocation screens.
--
-- Pre-flight (Section 5 of C2 spec) surfaced that the schema has a single
-- `windfalls` table (not the `windfall_events` + `windfall_allocations`
-- split the spec proposed). The `windfalls` row already carries an
-- `allocations` JSONB column intended for exactly this audit purpose, plus
-- `status` and `allocated_at` columns. So this migration ships only the
-- RPC — no DDL. Hybrid persistence (PM_DECISIONS.C.1):
--   - Writes p_allocations onto windfalls.allocations (audit trail)
--   - Flips status to 'allocated', sets allocated_at = now()
--   - Does NOT mutate goal.current_amount or monthly_rituals.safe_to_spend_locked
--
-- SECURITY DEFINER + auth.uid()-from-profiles resolution matches 0009 / 0011
-- / 0013. Caller's profile.id is derived, ownership of the windfall row is
-- validated, then the write is scoped.

CREATE OR REPLACE FUNCTION public.record_windfall_allocations(
  p_event_id    uuid,
  p_allocations jsonb       -- array of { bucket_kind, amount }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_owner_id   uuid;
  v_status     text;
  v_count      int;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for auth user %', auth.uid();
  END IF;

  -- Validate windfall exists, belongs to caller, and is still actionable.
  SELECT user_id, status
    INTO v_owner_id, v_status
  FROM public.windfalls
  WHERE id = p_event_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Windfall % not found', p_event_id;
  END IF;
  IF v_owner_id <> v_profile_id THEN
    RAISE EXCEPTION 'Windfall % does not belong to caller', p_event_id;
  END IF;
  IF v_status <> 'pending_allocation' THEN
    RAISE EXCEPTION 'Windfall % is not in pending_allocation status (was %)', p_event_id, v_status;
  END IF;

  -- Validate the array is non-empty.
  v_count := jsonb_array_length(p_allocations);
  IF v_count IS NULL OR v_count = 0 THEN
    RAISE EXCEPTION 'p_allocations must be a non-empty array';
  END IF;

  -- Atomic write: stash the JSONB array and flip status / allocated_at.
  UPDATE public.windfalls
     SET allocations  = p_allocations,
         status       = 'allocated',
         allocated_at = now()
   WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'status', 'allocated',
    'event_id', p_event_id,
    'allocation_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_windfall_allocations(uuid, jsonb) TO authenticated;
