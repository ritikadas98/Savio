-- 0009_complete_monthly_ritual.sql
--
-- Phase 3 Doc 1 — atomic ritual-complete mutation.
--
-- Runs as a single Postgres function so all writes succeed-or-fail together.
-- Implicit transaction wraps the body — no need for explicit BEGIN/COMMIT.
--
-- Writes:
--   1. INSERT into rollover_allocations (unless skip_rollover = true for
--      negative-leftover branch).
--   2. UPDATE monthly_rituals: status='completed', completed_at, rollover
--      link, close_out_snapshot.
--   3. If destination_kind in ('goal','emergency_fund'): UPDATE goals
--      to credit current_amount += total_amount.
--   4. carry_forward: no separate write — the safe-to-spend formula will
--      read rollover_allocations and include carry-forward amounts.
--
-- Security: SECURITY INVOKER (the default) so RLS policies apply with the
-- caller's auth. The user can only complete THEIR OWN pending ritual.

CREATE OR REPLACE FUNCTION public.complete_monthly_ritual(
  p_month_year       text,              -- '2026-04'
  p_skip_rollover    boolean,           -- true for negative-leftover branch
  p_source_breakdown jsonb,             -- full close-out JSON, or NULL when skipping
  p_total_amount     numeric,           -- net rolled (only used when not skipping)
  p_destination_kind text,              -- 'goal' | 'emergency_fund' | 'carry_forward', or NULL
  p_destination_goal_id uuid,           -- the goal to credit, or NULL
  p_close_out_snapshot jsonb            -- full close-out JSON for the ritual row
)
RETURNS uuid              -- returns rollover_allocations.id, or NULL when skipped
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_profile_id uuid;
  v_ritual_month date;
  v_rollover_id uuid;
BEGIN
  -- Resolve the caller's profile.id (RLS ensures we only see our own row)
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for auth user %', auth.uid();
  END IF;

  -- Parse 'YYYY-MM' into the 1st-of-month date used by rollover_allocations.ritual_month
  v_ritual_month := (p_month_year || '-01')::date;

  -- Validate destination_kind enum when not skipping
  IF NOT p_skip_rollover THEN
    IF p_destination_kind IS NULL OR p_destination_kind NOT IN ('goal','emergency_fund','carry_forward') THEN
      RAISE EXCEPTION 'Invalid destination_kind: %', p_destination_kind;
    END IF;
    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
      RAISE EXCEPTION 'total_amount must be positive when not skipping rollover (got %)', p_total_amount;
    END IF;
    IF p_destination_kind IN ('goal','emergency_fund') AND p_destination_goal_id IS NULL THEN
      RAISE EXCEPTION 'destination_goal_id required when destination_kind = %', p_destination_kind;
    END IF;
  END IF;

  -- 1. Insert rollover_allocations row (skip on negative-leftover branch)
  IF NOT p_skip_rollover THEN
    INSERT INTO public.rollover_allocations (
      user_id, ritual_month, source_breakdown, total_amount,
      destination_kind, destination_goal_id
    ) VALUES (
      v_profile_id, v_ritual_month, p_source_breakdown, p_total_amount,
      p_destination_kind, p_destination_goal_id
    )
    RETURNING id INTO v_rollover_id;
  END IF;

  -- 2. Update monthly_rituals row to completed
  UPDATE public.monthly_rituals
  SET
    status = 'completed',
    completed_at = now(),
    rollover_allocation_id = v_rollover_id,        -- NULL when skipped
    close_out_snapshot = p_close_out_snapshot
  WHERE user_id = v_profile_id AND month_year = p_month_year;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No monthly_rituals row found for user % month %', v_profile_id, p_month_year;
  END IF;

  -- 3. Credit the destination goal when applicable
  IF NOT p_skip_rollover AND p_destination_kind IN ('goal','emergency_fund') THEN
    UPDATE public.goals
    SET current_amount = COALESCE(current_amount, 0) + p_total_amount
    WHERE id = p_destination_goal_id AND user_id = v_profile_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Destination goal % not found for user %', p_destination_goal_id, v_profile_id;
    END IF;
  END IF;

  -- carry_forward intentionally has no separate write — the safe-to-spend
  -- recompute on the home/grounding context will SUM rollover_allocations
  -- where destination_kind='carry_forward' and ritual_month = previous month.

  RETURN v_rollover_id;
END;
$$;

-- Grant execute to the authenticated role
GRANT EXECUTE ON FUNCTION public.complete_monthly_ritual(text, boolean, jsonb, numeric, text, uuid, jsonb) TO authenticated;
