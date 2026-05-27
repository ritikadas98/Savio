-- 0013_complete_monthly_setup_rpc.sql
--
-- Phase 3 C1 — Lock-in RPC for the new-month setup ritual screens 4-7
-- (income confirmation, commitments scan, focus goal, lock-in).
--
-- The existing complete_monthly_ritual(p_month_year, p_allocations jsonb)
-- closes out the PREVIOUS month — writes rollover_allocations rows and
-- marks the M-1 ritual row completed. That RPC is unchanged.
--
-- This new RPC closes out the NEW month's setup — writes safe_to_spend_locked,
-- focus_goal_id, income_confirmed onto the M ritual row (creating it via
-- UPSERT since the seed only has rows through M-1).
--
-- SECURITY DEFINER + auth.uid() resolution matches the pattern from 0009
-- and 0011 — caller's profile.id is derived, then writes scope by that.

CREATE OR REPLACE FUNCTION public.complete_monthly_setup(
  p_month_year             text,        -- 'YYYY-MM' for the new month being set up
  p_focus_goal_id          uuid,        -- null allowed (= "No specific focus")
  p_safe_to_spend_locked   numeric,     -- computed at lock-in screen
  p_confirmed_income       numeric      -- salary + any other (just salary for MVP)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for auth user %', auth.uid();
  END IF;

  -- Validate focus_goal_id belongs to this user (if non-null)
  IF p_focus_goal_id IS NOT NULL THEN
    PERFORM 1 FROM public.goals
      WHERE id = p_focus_goal_id AND user_id = v_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'focus_goal_id % not found for user %', p_focus_goal_id, v_profile_id;
    END IF;
  END IF;

  -- UPSERT — May ritual row may not exist yet on first setup. If it does
  -- (e.g. user re-runs setup), update the existing row.
  SELECT id INTO v_existing_id
  FROM public.monthly_rituals
  WHERE user_id = v_profile_id AND month_year = p_month_year;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.monthly_rituals (
      user_id, month_year, status, income_confirmed,
      commitments_confirmed, focus_goal_id, safe_to_spend_locked, completed_at
    )
    VALUES (
      v_profile_id, p_month_year, 'completed', p_confirmed_income,
      true, p_focus_goal_id, p_safe_to_spend_locked, now()
    )
    RETURNING id INTO v_existing_id;
  ELSE
    UPDATE public.monthly_rituals
    SET status = 'completed',
        income_confirmed = p_confirmed_income,
        commitments_confirmed = true,
        focus_goal_id = p_focus_goal_id,
        safe_to_spend_locked = p_safe_to_spend_locked,
        completed_at = now()
    WHERE id = v_existing_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'completed',
    'ritual_id', v_existing_id,
    'month_year', p_month_year,
    'safe_to_spend_locked', p_safe_to_spend_locked,
    'focus_goal_id', p_focus_goal_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_monthly_setup(text, uuid, numeric, numeric) TO authenticated;
